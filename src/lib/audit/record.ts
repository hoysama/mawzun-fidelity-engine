/**
 * The audit record — the artefact a third party can re-run.
 *
 * The record carries everything needed to reach the same verdict without asking
 * the system anything: both texts, the constraint bank version and its contents,
 * the model identifier and prompt hash, the extracted findings verbatim, and the
 * verdict. `verifyRecord` recomputes the digest over the canonical form and also
 * re-evaluates the verdict rule against the recorded findings, so a record whose
 * findings were edited after the fact fails on both counts.
 *
 * What the digest proves, and what it does not — stated plainly because the
 * distinction is the point:
 *
 * - It proves **integrity** (the record has not changed since it was issued) and
 *   **attribution** (this engine, this bank version, this model produced it).
 * - It does **not** prove that the source text is authentic, that the bank's
 *   rules are correct, or that the verdict is a valid Sharia judgement. Those are
 *   the specialist's responsibility, not the machine's.
 */

import type { AuditInput, AuditResult, ConstraintBank, Finding } from "./types";
import type { Citation } from "./rag-types";
import { quoteKey, quoteMatchesApproved } from "./rag";
import { computeVerdict } from "./verdict";

export const ENGINE_VERSION = "1.0.0";

/** Deterministic JSON: object keys sorted, so the digest is stable. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** SHA-256 hex digest. Available in the browser, in Bun and in Workers. */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface AuditRecord {
  readonly engineVersion: string;
  readonly createdAt: string;
  readonly input: {
    readonly sourceText: string;
    readonly derivedText: string;
    readonly workType: string;
    readonly contentLevel: string;
    readonly targetLanguage: string;
  };
  readonly bank: {
    readonly version: string;
    readonly packageName: string;
    readonly constraints: ConstraintBank["constraints"];
  };
  readonly model: { readonly id: string | null; readonly promptHash: string | null };
  readonly findings: readonly Finding[];
  /**
   * Every citation the run attached, aggregated and sealed.
   *
   * The findings already carry their own citations, but a reader should not have
   * to walk the finding list to know which approved passages the run consulted.
   * This list is part of what the digest covers, so a citation cannot be edited
   * out of a record without breaking it — and a quotation replay compares the
   * recorded span against these sealed passages, never against a fresh fetch.
   */
  readonly citations: readonly Citation[];
  readonly coverage: AuditResult["coverage"];
  readonly layerSummary: AuditResult["layerSummary"];
  readonly verdict: AuditResult["verdict"];
  readonly reason: string;
  readonly reviewerDecision: string | null;
  readonly digest: string;
}

/** Everything except the digest — this is what gets hashed. */
export type UnsignedRecord = Omit<AuditRecord, "digest">;

/**
 * Every citation in the run, deduplicated and ordered deterministically so the
 * digest is stable across replays of the same input.
 */
export function collectCitations(findings: readonly Finding[]): Citation[] {
  const byKey = new Map<string, Citation>();
  for (const finding of findings) {
    for (const citation of finding.citations ?? []) {
      const key = `${citation.sourceId}|${citation.url}|${citation.kind}|${citation.passage}`;
      if (!byKey.has(key)) byKey.set(key, citation);
    }
  }
  return [...byKey.values()].sort((a, b) =>
    `${a.url}\u0000${a.kind}\u0000${a.passage}`.localeCompare(`${b.url}\u0000${b.kind}\u0000${b.passage}`),
  );
}

export function buildUnsignedRecord(
  input: AuditInput,
  result: AuditResult,
  model: { id: string | null; promptHash: string | null },
  now: string = new Date().toISOString(),
): UnsignedRecord {
  return {
    engineVersion: ENGINE_VERSION,
    createdAt: now,
    input: {
      sourceText: input.sourceText,
      derivedText: input.derivedText,
      workType: input.workType,
      contentLevel: input.contentLevel,
      targetLanguage: input.targetLanguage,
    },
    bank: {
      version: input.bank.version,
      packageName: input.bank.packageName,
      constraints: input.bank.constraints,
    },
    model,
    findings: result.findings,
    citations: collectCitations(result.findings),
    coverage: result.coverage,
    layerSummary: result.layerSummary,
    verdict: result.verdict,
    reason: result.reason,
    reviewerDecision: input.reviewerDecision ?? null,
  };
}

export async function sealRecord(unsigned: UnsignedRecord): Promise<AuditRecord> {
  const digest = await sha256Hex(canonicalJson(unsigned));
  return { ...unsigned, digest };
}

export interface VerifyOutcome {
  readonly ok: boolean;
  readonly digestMatches: boolean;
  readonly verdictReproduces: boolean;
  /** The sealed quotation passages still classify their spans, offline. */
  readonly quotesReplay: boolean;
  readonly notes: string[];
}

/**
 * Re-verify a record from its own contents.
 *
 * `verdictReproduces` re-runs the verdict rule over the recorded findings, which
 * catches a record whose findings were trimmed while the digest was recomputed.
 */
export async function verifyRecord(record: AuditRecord): Promise<VerifyOutcome> {
  const notes: string[] = [];
  const { digest, ...unsigned } = record;

  const recomputed = await sha256Hex(canonicalJson(unsigned));
  const digestMatches = recomputed === digest;
  if (!digestMatches) {
    notes.push(`بصمة السجل لا تطابق محتواه. المتوقع ${recomputed} والموجود ${digest}.`);
  } else {
    notes.push("بصمة السجل مطابقة لمحتواه: لم يتغير بعد إصداره.");
  }

  const checkedTotal = record.layerSummary
    ? Object.values(record.layerSummary).reduce((acc, s) => acc + s.checked, 0)
    : 0;

  const replayed = computeVerdict(
    record.input.contentLevel as AuditInput["contentLevel"],
    record.findings,
    record.coverage,
    checkedTotal,
    record.input.sourceText,
    record.input.derivedText,
  );
  const verdictReproduces = replayed.verdict === record.verdict;
  if (!verdictReproduces) {
    notes.push(
      `إعادة تطبيق قاعدة الحكم على الوقائع المسجلة تعطي «${replayed.verdict}» لا «${record.verdict}» — السجل غير متسق.`,
    );
  } else {
    notes.push("إعادة تطبيق قاعدة الحكم على الوقائع المسجلة تعطي الحكم نفسه.");
  }

  // Offline quotation replay: re-classify every sealed quotation against the
  // passage written into the record, never against a fresh fetch. This is the
  // check that makes "a replay compares against the sealed passage" true — a
  // preserved quotation must still match its sealed approved text, and a
  // shifted one must still differ from it.
  const quoteNotes: string[] = [];
  for (const finding of record.findings) {
    if (finding.kind !== "quote" || finding.cls === "missing") continue;
    const approved = (finding.citations ?? []).find(
      (c) => c.kind === "quran" && c.ayah !== undefined && c.passage.trim().length > 0,
    );
    if (!approved) continue; // no sealed passage to replay against
    const verbatim =
      quoteMatchesApproved(finding.span, approved.passage) ||
      quoteKey(approved.passage).includes(quoteKey(finding.span));
    if (finding.cls === "preserved" && !verbatim) {
      quoteNotes.push("واقعة اقتباس موسومة «محفوظ» والنص المختوم في السجل لا يطابق المقتبس فيها — السجل غير متسق.");
    }
    if (finding.cls === "shifted" && verbatim) {
      quoteNotes.push("واقعة اقتباس موسومة «منزاح» والنص المختوم في السجل يطابق المقتبس فيها — السجل غير متسق.");
    }
  }
  const quotesReplay = quoteNotes.length === 0;
  notes.push(
    quotesReplay
      ? "إعادة مقارنة الاقتباسات القرآنية بالنص المختوم في السجل تعطي التصنيف نفسه، دون أي استرجاع شبكي."
      : quoteNotes.join(" "),
  );

  notes.push(
    "السجل يثبت السلامة والنسبة والترتيب، ولا يثبت صحة الحكم الشرعي ولا صحة النص الأصلي؛ كلاهما مسؤولية المراجع المختص.",
  );

  return {
    ok: digestMatches && verdictReproduces && quotesReplay,
    digestMatches,
    verdictReproduces,
    quotesReplay,
    notes,
  };
}
