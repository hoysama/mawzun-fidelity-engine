/**
 * The audit engine entry point.
 *
 * Runs the three layers in order and then the verdict rule, and seals the whole
 * run into a record. The engine itself is pure — no network, no storage, no
 * clock beyond the timestamp it is handed — so the same input with the same
 * semantic provider and the same retriever yields the same findings and the
 * same verdict. That is what makes "re-run it and you get the same verdict" a
 * property rather than a hope.
 *
 * Retrieval is the one boundary that can touch the network. It is injected like
 * the semantic provider: the live connectors are the default, and a check
 * passes a deterministic fake, so no test needs the internet. `retriever: null`
 * disables retrieval outright and layer 1 declares that gap rather than passing
 * quietly.
 */

import type { AuditInput, AuditResult, CoverageNote, Finding } from "./types";
import type { LayerContext, QuoteLookup, Retriever } from "./layer-context";
import { extractQuranQuotes, runLayer1 } from "./layer1-deterministic";
import { runLayer2, type AlignmentKind } from "./layer2-lexical";
import { declaredGapProvider, type SemanticProvider } from "./layer3-semantic";
import { computeVerdict, hasQuranQuoteMarker, summariseLayers } from "./verdict";
import { buildUnsignedRecord, sealRecord, type AuditRecord } from "./record";
import { citationsForQuranicSpan, fetchQuranAyah, locateAyahForQuote, quoteKey } from "./rag";

/**
 * How many layer-3 findings one run will attach a Quranic citation to.
 *
 * A second bounded ceiling, beside `MAX_QURAN_LOOKUPS_PER_RUN` in layer 1. The
 * per-run request budget is therefore at most 8 quotation lookups × 3 GETs
 * (two search probes + one mushaf fetch) plus 4 span citations × 2 GETs, plus
 * one reachability probe — at most 33 HTTP GETs, comfortably under the
 * 60/minute limiter the connector enforces. Retrieval is a bounded supplement,
 * never an unbounded fan-out.
 */
export const MAX_L3_CITATION_LOOKUPS_PER_RUN = 4;

export interface AuditRunOptions {
  /** Injected so the engine stays testable and the browser stays model-free. */
  readonly semantic?: SemanticProvider;
  /**
   * The retrieval boundary. `undefined` uses the live connectors (production);
   * `null` disables retrieval so layer 1 reports it could not run; a value is
   * the injected retriever a check supplies.
   */
  readonly retriever?: Retriever | null;
  /** Fixed timestamp, so a replayed run produces an identical record. */
  readonly now?: string;
}

export interface AuditRunOutput {
  readonly result: AuditResult;
  readonly record: AuditRecord;
  /** Model output that failed the verbatim-quote gate, kept for the record. */
  readonly rejected: readonly string[];
  readonly alignment: AlignmentKind;
}

const NEEDS_MODEL_REASON =
  "الطبقة الدلالية لم تُشغَّل في هذا البناء: تحتاج ربط نموذج. ما كان يمكن كشفه بالاستدلال الدلالي غير مفحوص.";

/**
 * The live retrieval boundary, backed by the connectors in `rag.ts`.
 *
 * One instance per run, so the per-run ceiling and the lookup cache are scoped
 * to the run: the same quotation is never located twice, and the request count
 * is bounded by layer 1 (for quotations) and by the layer-3 cap below (for the
 * semantic spans).
 */
function liveRetriever(): Retriever {
  const cache = new Map<string, QuoteLookup>();
  let spanLookups = 0;
  let reachable: { ok: boolean; note?: string } | null = null;

  /**
   * One cheap probe, run at most once per run, so a quotation that cannot be
   * located is told apart from a source that cannot be reached. Without it a
   * network failure would be reported as "not found", which under-claims.
   */
  const sourceReachable = async (): Promise<{ ok: boolean; note?: string }> => {
    if (reachable) return reachable;
    const probe = await fetchQuranAyah(1, 1);
    reachable =
      probe.citations.length > 0
        ? { ok: true }
        : { ok: false, note: probe.note ?? "لم يستجب المصحف المعتمد لفحص الاتصال." };
    return reachable;
  };

  return {
    id: "live-quranpedia",

    async lookupQuote(quote: string): Promise<QuoteLookup> {
      const key = quoteKey(quote);
      const cached = cache.get(key);
      if (cached) return cached;

      let outcome: QuoteLookup;
      if (typeof window !== "undefined") {
        outcome = {
          status: "unavailable",
          note: "الاسترجاع يعمل على الخادم وحده، وهذا التشغيل جرى في المتصفح.",
        };
      } else {
        const located = await locateAyahForQuote(quote);
        if (!located) {
          const reach = await sourceReachable();
          outcome = reach.ok ? { status: "unlocated" } : { status: "unavailable", note: reach.note ?? "تعذّر الوصول إلى المصحف المعتمد." };
        } else {
          const ayah = await fetchQuranAyah(located.surah, located.ayah);
          const citation = ayah.citations[0];
          outcome = citation
            ? {
                status: "located",
                ayah: { surah: located.surah, ayah: located.ayah },
                approved: citation.passage,
                citation,
              }
            : {
                status: "unavailable",
                note: ayah.note ?? "تعذّر الوصول إلى النص القرآني المعتمد.",
              };
        }
      }

      cache.set(key, outcome);
      return outcome;
    },

    async citeSpan(span: string) {
      if (typeof window !== "undefined") {
        return { citations: [], note: "الاسترجاع يعمل على الخادم وحده، وهذا التشغيل جرى في المتصفح." };
      }
      if (spanLookups >= MAX_L3_CITATION_LOOKUPS_PER_RUN) {
        return {
          citations: [],
          note: `تجاوز عدد الإحالات القرآنية في الطبقة الدلالية سقف التشغيل (${MAX_L3_CITATION_LOOKUPS_PER_RUN})، فما زاد عليه غير مفحوص.`,
        };
      }
      spanLookups++;
      return citationsForQuranicSpan(span);
    },
  };
}

/**
 * Attach the approved Quranic citation to any layer-3 finding whose span sits
 * inside a quotation marked in either text. A span that looks Quranic but
 * cannot be tied to an ayah yields a coverage note — an empty citation list is
 * never quietly read as agreement.
 */
async function attachQuranicCitations(
  l3Findings: readonly Finding[],
  ctx: LayerContext,
  retriever: Retriever | undefined,
  coverage: CoverageNote[],
): Promise<Finding[]> {
  if (!retriever) return [...l3Findings];

  const derivedSpans = extractQuranQuotes(ctx.derived);
  const sourceSpans = extractQuranQuotes(ctx.source);
  const out: Finding[] = [];
  let attempted = 0;

  for (const finding of l3Findings) {
    const looksQuranic =
      hasQuranQuoteMarker(finding.span) ||
      hasQuranQuoteMarker(finding.evidence.source) ||
      hasQuranQuoteMarker(finding.evidence.derived) ||
      (finding.start > 0 && derivedSpans.some((q) => finding.start >= q.start && finding.start < q.end)) ||
      sourceSpans.some((q) => q.text.length > 0 && finding.evidence.source.includes(q.text));

    if (!looksQuranic || attempted >= MAX_L3_CITATION_LOOKUPS_PER_RUN) {
      out.push(finding);
      continue;
    }

    attempted++;
    const outcome = await retriever.citeSpan(finding.span || finding.evidence.derived);
    if (outcome.citations.length > 0) {
      out.push({ ...finding, citations: outcome.citations });
    } else {
      out.push(finding);
      coverage.push({
        layer: "L3",
        kind: "quote",
        reason:
          outcome.note ??
          "وقعت في الطبقة الدلالية إشارة إلى مقطع يشبه الاقتباس القرآني ولم يمكن ربطه بموضع معتمد؛ المقطع غير مربوط، وهذا ليس حكمًا بأنه خطأ.",
      });
    }
  }

  return out;
}

export async function runAudit(input: AuditInput, options: AuditRunOptions = {}): Promise<AuditRunOutput> {
  const findings: Finding[] = [];
  const coverage: CoverageNote[] = [];
  let checked = 0;
  let alignment: AlignmentKind = "proportional";
  let model: { id: string | null; promptHash: string | null } = { id: null, promptHash: null };
  let rejected: string[] = [];

  const retriever = options.retriever === undefined ? liveRetriever() : options.retriever ?? undefined;

  const ctx: LayerContext = {
    source: input.sourceText,
    derived: input.derivedText,
    language: input.targetLanguage,
    level: input.contentLevel,
    bank: input.bank,
    now: options.now,
    retriever,
    workType: input.workType,
  };

  if (input.contentLevel === "D") {
    // Level د is never checked: the rule is to stop and refer, so running the
    // layers would produce a verdict the system is not allowed to give.
    coverage.push({
      layer: "L1",
      kind: "quote",
      reason: "مستوى (د): لم يُجرَ أي فحص بحسب القاعدة؛ النظام يوقف ويحيل.",
    });
  } else {
    const l1 = await runLayer1(ctx);
    findings.push(...l1.findings);
    coverage.push(...l1.coverage);
    checked += l1.checked;

    const l2 = runLayer2(ctx);
    findings.push(...l2.findings);
    coverage.push(...l2.coverage);
    checked += l2.checked;
    alignment = l2.alignment;

    const provider = options.semantic ?? declaredGapProvider(NEEDS_MODEL_REASON);
    try {
      const l3 = await provider.run(ctx);
      const cited = await attachQuranicCitations(l3.findings, ctx, retriever, coverage);
      findings.push(...cited);
      coverage.push(...l3.coverage);
      checked += l3.checked;
      model = { id: l3.model, promptHash: l3.promptHash };
      rejected = l3.rejected;
    } catch (error) {
      // A failing provider must not cost us the deterministic findings. The
      // failure is recorded as a declared gap, so the verdict states that the
      // semantic layer did not produce a result rather than passing quietly.
      const detail = error instanceof Error ? error.message : String(error);
      coverage.push({
        layer: "L3",
        kind: "condition",
        reason: `فشلت الطبقة الدلالية في هذا التشغيل: ${detail}. ما كان يمكن كشفه بالاستدلال الدلالي غير مفحوص.`,
      });
    }
  }

  findings.sort((a, b) => (a.layer === b.layer ? a.start - b.start : a.layer.localeCompare(b.layer)));

  const { summary, coverage: allCoverage } = summariseLayers(findings, coverage);
  const { verdict, reason } = computeVerdict(
    input.contentLevel,
    findings,
    allCoverage,
    checked,
    input.sourceText,
    input.derivedText,
  );

  const result: AuditResult = {
    verdict,
    reason,
    findings,
    layerSummary: summary,
    coverage: allCoverage,
  };

  const unsigned = buildUnsignedRecord(input, result, model, options.now);
  const record = await sealRecord(unsigned);

  return { result, record, rejected, alignment };
}

export { buildConstraintBank, bankLanguages, CONSTRAINT_BANK_VERSION } from "./constraint-bank";
export { declaredGapProvider, modelProvider, buildSemanticPrompt, parseSemanticFindings } from "./layer3-semantic";
export type { SemanticProvider, SemanticCallResult, SemanticCaller } from "./layer3-semantic";
export { verifyRecord, canonicalJson, sha256Hex, ENGINE_VERSION, buildUnsignedRecord, sealRecord } from "./record";
export type { AuditRecord, VerifyOutcome } from "./record";
export { RULING_TERMS, FORCE_PROFILES, forcesConflict } from "./ruling-strength";
export type { RulingForce } from "./ruling-strength";
export { segmentText } from "./layer2-lexical";
export { extractQuranQuotes, MAX_QURAN_LOOKUPS_PER_RUN } from "./layer1-deterministic";
export type { Retriever, QuoteLookup } from "./layer-context";
export type * from "./types";
