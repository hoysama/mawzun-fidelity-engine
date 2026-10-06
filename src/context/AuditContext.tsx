"use client";

/**
 * Audit workflow state.
 *
 * Persistence goes through a tiny external store rather than an effect that
 * calls `setState`: reading localStorage in an effect and pushing it back into
 * state causes a cascading render on every mount, and the repository's lint
 * config rejects it. `useSyncExternalStore` also gives the correct hydration
 * behaviour for free — the server snapshot is the empty state, and the stored
 * run appears once the client subscribes.
 *
 * The engine is isomorphic, so `run` has two paths and prefers the honest one:
 * it asks the server route first (which can reach the model through the
 * Cloudflare AI binding), and if the route is unreachable it runs the engine in
 * the browser with the declared-gap semantic provider. Falling back never
 * pretends layer 3 ran — the record says which path produced it.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  buildConstraintBank,
  buildUnsignedRecord,
  declaredGapProvider,
  runAudit,
  sealRecord,
  verifyRecord,
  type AuditRecord,
  type AuditResult,
  type VerifyOutcome,
} from "@/lib/audit";
import type { AuditInput, ContentLevel, WorkType } from "@/lib/audit/types";

const STORAGE_KEY = "mawzun_audit_state_v1";

interface PersistedState {
  sourceText: string;
  derivedText: string;
  workType: WorkType;
  contentLevel: ContentLevel;
  targetLanguage: string;
  reviewerDecision: string;
}

interface AuditContextValue extends PersistedState {
  setSourceText: (value: string) => void;
  setDerivedText: (value: string) => void;
  setWorkType: (value: WorkType) => void;
  setContentLevel: (value: ContentLevel) => void;
  setTargetLanguage: (value: string) => void;
  setReviewerDecision: (value: string) => void;
  run: () => Promise<void>;
  reset: () => void;
  isRunning: boolean;
  error: string | null;
  result: AuditResult | null;
  record: AuditRecord | null;
  rejected: readonly string[];
  alignment: string | null;
  /** Where the last run executed: server route or in-browser fallback. */
  runPath: "server" | "browser" | null;
  verification: VerifyOutcome | null;
  verify: () => Promise<void>;
}

const EMPTY: PersistedState = {
  sourceText: "",
  derivedText: "",
  workType: "translate",
  contentLevel: "B",
  targetLanguage: "en",
  reviewerDecision: "",
};

// --- external store -------------------------------------------------------

let storeState: PersistedState = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function loadFromStorage(): PersistedState {
  if (typeof window === "undefined") return EMPTY;
  let base: PersistedState = EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    base = raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<PersistedState>) } : EMPTY;
  } catch {
    base = EMPTY;
  }

  return base;
}

function readStore(): PersistedState {
  if (!hydrated) {
    storeState = loadFromStorage();
    hydrated = true;
  }
  return storeState;
}

function getServerSnapshot(): PersistedState {
  return EMPTY;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function writeStore(next: Partial<PersistedState>): void {
  storeState = { ...readStore(), ...next };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storeState));
  } catch {
    // Storage being unavailable only costs persistence, not correctness.
  }
  for (const listener of listeners) listener();
}

// -------------------------------------------------------------------------

const AuditContext = createContext<AuditContextValue | undefined>(undefined);

export function AuditProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, readStore, getServerSnapshot);

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [record, setRecord] = useState<AuditRecord | null>(null);
  const [rejected, setRejected] = useState<readonly string[]>([]);
  const [alignment, setAlignment] = useState<string | null>(null);
  const [runPath, setRunPath] = useState<"server" | "browser" | null>(null);
  const [verification, setVerification] = useState<VerifyOutcome | null>(null);

  const buildInput = useCallback((): AuditInput => {
    const current = readStore();
    return {
      sourceText: current.sourceText,
      derivedText: current.derivedText,
      workType: current.workType,
      contentLevel: current.contentLevel,
      targetLanguage: current.targetLanguage,
      bank: buildConstraintBank(),
      reviewerDecision: current.reviewerDecision || null,
    };
  }, []);

  const run = useCallback(async () => {
    const input = buildInput();

    // Only the source is required. An empty derived is a valid input: it means
    // nothing was transmitted, and the engine reports that as needs_revision
    // with the source-side constraints marked missing — never as faithful.
    if (!input.sourceText.trim()) {
      setError("النص الأصلي مطلوب.");
      return;
    }

    setIsRunning(true);
    setError(null);
    setVerification(null);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText: input.sourceText,
          derivedText: input.derivedText,
          workType: input.workType,
          contentLevel: input.contentLevel,
          targetLanguage: input.targetLanguage,
          reviewerDecision: input.reviewerDecision,
        }),
      });

      if (!response.ok) throw new Error(`route responded ${response.status}`);

      const data = (await response.json()) as {
        ok: boolean;
        result: AuditResult;
        record: AuditRecord;
        rejected: string[];
        alignment: string;
      };
      if (!data.ok) throw new Error("route reported failure");

      setResult(data.result);
      setRecord(data.record);
      setRejected(data.rejected ?? []);
      setAlignment(data.alignment ?? null);
      setRunPath("server");
    } catch {
      // The route is unreachable (no Worker, no binding, offline). The engine
      // runs here instead, and layer 3 declares itself absent rather than
      // passing quietly.
      const local = await runAudit(input, {
        semantic: declaredGapProvider(
          "الطبقة الدلالية لم تُشغَّل: تعذّر الوصول إلى الخدمة، فنُفّذ الفحص حتميًا في المتصفح فقط. ما كان يمكن كشفه بالاستدلال الدلالي غير مفحوص.",
        ),
      });
      setResult(local.result);
      setRecord(local.record);
      setRejected(local.rejected);
      setAlignment(local.alignment);
      setRunPath("browser");
    } finally {
      setIsRunning(false);
    }
  }, [buildInput]);

  const verify = useCallback(async () => {
    if (!record) return;
    setVerification(await verifyRecord(record));
  }, [record]);

  const reset = useCallback(() => {
    writeStore(EMPTY);
    setResult(null);
    setRecord(null);
    setRejected([]);
    setAlignment(null);
    setRunPath(null);
    setVerification(null);
    setError(null);
  }, []);

  /**
   * Record the human reviewer's decision into the sealed record.
   *
   * Re-sealing is deliberate: the decision is part of what the digest covers, so
   * a record that later shows a different decision fails verification.
   */
  const setReviewerDecision = useCallback(
    (value: string) => {
      writeStore({ reviewerDecision: value });
      if (!result || !record) return;
      const unsigned = buildUnsignedRecord(
        { ...buildInput(), reviewerDecision: value || null },
        result,
        { id: record.model.id, promptHash: record.model.promptHash },
        record.createdAt,
      );
      void sealRecord(unsigned).then(setRecord);
    },
    [buildInput, record, result],
  );

  const value = useMemo<AuditContextValue>(
    () => ({
      ...state,
      setSourceText: (v: string) => writeStore({ sourceText: v }),
      setDerivedText: (v: string) => writeStore({ derivedText: v }),
      setWorkType: (v: WorkType) => writeStore({ workType: v }),
      setContentLevel: (v: ContentLevel) => writeStore({ contentLevel: v }),
      setTargetLanguage: (v: string) => writeStore({ targetLanguage: v }),
      setReviewerDecision,
      run,
      reset,
      isRunning,
      error,
      result,
      record,
      rejected,
      alignment,
      runPath,
      verification,
      verify,
    }),
    [
      state,
      setReviewerDecision,
      run,
      reset,
      isRunning,
      error,
      result,
      record,
      rejected,
      alignment,
      runPath,
      verification,
      verify,
    ],
  );

  return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>;
}

export function useAudit(): AuditContextValue {
  const context = useContext(AuditContext);
  if (!context) throw new Error("useAudit must be used inside AuditProvider");
  return context;
}
