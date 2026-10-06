/**
 * Layer 3 — semantic findings, produced by a model but never *judged* by it.
 *
 * The contract that makes this layer auditable:
 *
 * 1. The model returns **facts, not verdicts** — a list of findings, each with
 *    the question it answers, a classification, and two verbatim quotes.
 * 2. A finding is evidence only when it is anchored on **both sides**: a source
 *    fragment and a derived fragment, each found verbatim in its own text after
 *    the project's normalization. A quote the text does not contain is rejected,
 *    and the rejection is recorded — the model cannot invent a location.
 * 3. Two classes are rejected outright because the two texts can never settle
 *    them, however the model words them: an `attribution` (isnad) claim — a
 *    hadith grade, a chain, a narrator's soundness — which is a fact about the
 *    world *outside* the two inputs, and a `missing` claim, which by definition
 *    has no derived span to verify. Both are recorded as declined claims, never
 *    admitted on the model's word.
 * 4. The model never decides the outcome. It fills `Finding[]`, and
 *    `verdict.ts` computes the verdict from those findings with a fixed rule.
 *
 * The provider is injected, so the engine stays pure and testable: the browser
 * and the test harness use `declaredGapProvider`, the server route wires in the
 * Cloudflare Workers AI binding.
 */

import type { CoverageNote, Finding, FindingClass, ConstraintKind } from "./types";
import { findPhrase, normalizeWithMap } from "./normalize";
import type { LayerContext, LayerOutput } from "./layer-context";

/** The three questions this layer is allowed to ask. */
export type SemanticQuestion = "condition" | "attribution" | "ruling_force";

export interface SemanticRawFinding {
  readonly question: SemanticQuestion;
  readonly cls: FindingClass;
  /** Must appear verbatim in the source text, or the finding is rejected. */
  readonly source_quote: string;
  /** Must appear verbatim in the derived text, or the finding is rejected. */
  readonly derived_quote: string;
  readonly note: string;
}

export interface SemanticCallResult {
  readonly raw: string;
  /** Model identifier and prompt hash, recorded in the audit record. */
  readonly model: string;
  readonly promptHash: string;
}

export type SemanticCaller = (prompt: string, ctx: LayerContext) => Promise<SemanticCallResult>;

export interface SemanticProvider {
  readonly id: string;
  run(ctx: LayerContext): Promise<LayerOutput & { model: string | null; promptHash: string | null; rejected: string[] }>;
}

const QUESTION_TO_KIND: Readonly<Record<SemanticQuestion, ConstraintKind>> = {
  condition: "condition",
  attribution: "isnad",
  ruling_force: "ruling",
};

const QUESTIONS: readonly SemanticQuestion[] = ["condition", "attribution", "ruling_force"];
const CLASSES: readonly FindingClass[] = ["preserved", "shifted", "missing"];

/**
 * Turn raw model output into accepted findings plus a list of rejections.
 *
 * Exported because it is the security boundary of this layer: the tests drive
 * it directly with hostile model output.
 */
export function parseSemanticFindings(
  rawModelOutput: string,
  ctx: LayerContext,
): { findings: Finding[]; rejected: string[]; invalid: number } {
  const rejected: string[] = [];
  const findings: Finding[] = [];
  let invalid = 0;

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(rawModelOutput));
  } catch {
    return { findings: [], rejected: ["لم يكن مخرج النموذج JSON صالحًا — رُفض المخرج كله."], invalid: 1 };
  }

  const list =
    parsed && typeof parsed === "object" && Array.isArray((parsed as { findings?: unknown }).findings)
      ? ((parsed as { findings: unknown[] }).findings as unknown[])
      : null;

  if (!list) {
    return { findings: [], rejected: ["مخرج النموذج لا يحتوي حقل findings — رُفض كله."], invalid: 1 };
  }

  const script =
    ctx.language.toLowerCase().startsWith("ar") || ctx.language.toLowerCase().startsWith("ur")
      ? "arabic"
      : "latin";
  const sourceNorm = normalizeWithMap(ctx.source, "arabic");
  const derivedNorm = normalizeWithMap(ctx.derived, script);

  for (const item of list) {
    if (!item || typeof item !== "object") {
      invalid++;
      continue;
    }
    const f = item as Partial<SemanticRawFinding>;

    if (!f.question || !QUESTIONS.includes(f.question)) {
      rejected.push(`حقل question غير مسموح: ${String(f.question)}`);
      invalid++;
      continue;
    }
    if (!f.cls || !CLASSES.includes(f.cls)) {
      rejected.push(`حقل cls غير مسموح: ${String(f.cls)}`);
      invalid++;
      continue;
    }
    // An attribution (isnad) claim — a hadith grade, a chain, a narrator's
    // soundness — is a fact about the world outside these two texts. No
    // verbatim span can settle it, so it is never admitted on the model's
    // word: the claim is rejected and recorded, even when its quotes are real.
    if (f.question === "attribution") {
      rejected.push(
        `واقعة «السند» (attribution) مرفوضة: صحة النسبة ودرجة الثبوت تقعان خارج النصين، فلا يمكن التحقق منهما من الأصل والمشتق ولو طابق الاقتباس.${claimSuffix(f)}`,
      );
      invalid++;
      continue;
    }

    // A `missing` claim points at nothing in the derived text, so the engine
    // cannot verify it mechanically against the two texts. It is rejected and
    // recorded rather than condemning a translation on the model's word.
    if (f.cls === "missing") {
      rejected.push(
        `واقعة «مفقود» مرفوضة: لا مقطع مقابل في المشتق يُربط إليه الغياب، فلا يمكن إثبات النقص من النصين.${claimSuffix(f)}`,
      );
      invalid++;
      continue;
    }

    if (typeof f.source_quote !== "string" || typeof f.derived_quote !== "string") {
      rejected.push("اقتباس ناقص: كل واقعة يجب أن تحمل نصًا من الأصل ونصًا من المشتق.");
      invalid++;
      continue;
    }

    const sourceHit = findPhrase(sourceNorm, ctx.source, f.source_quote)[0];
    if (!sourceHit) {
      rejected.push(`اقتباس الأصل غير موجود في النص حرفيًا: «${truncate(f.source_quote)}»`);
      invalid++;
      continue;
    }

    // The boundary where a model claim becomes engine evidence: it must be
    // anchored on both sides — the source fragment and the derived fragment,
    // each verbatim in its own text. Nothing passes it the texts cannot show.
    const derivedHit = findPhrase(derivedNorm, ctx.derived, f.derived_quote)[0];
    if (!derivedHit) {
      rejected.push(`اقتباس المشتق غير موجود في النص حرفيًا: «${truncate(f.derived_quote)}»`);
      invalid++;
      continue;
    }

    findings.push({
      layer: "L3",
      constraintId: null,
      kind: QUESTION_TO_KIND[f.question],
      cls: f.cls,
      start: derivedHit.start,
      end: derivedHit.end,
      span: derivedHit.text,
      evidence: { source: sourceHit.text, derived: derivedHit.text, note: f.note ?? "" },
    });
  }

  return { findings, rejected, invalid };
}

/** Build the prompt. Kept here so its hash can travel in the record. */
export function buildSemanticPrompt(ctx: LayerContext): string {
  return [
    "أنت مساعد فحص أمانة نقل لنصوص شرعية. مهمتك تسجيل وقائع، لا إصدار حكم.",
    "",
    "أجب بـ JSON فقط بالشكل: {\"findings\":[{\"question\":\"condition|attribution|ruling_force\",\"cls\":\"preserved|shifted|missing\",\"source_quote\":\"...\",\"derived_quote\":\"...\",\"note\":\"...\"}]}",
    "",
    "قيود ملزمة:",
    "- source_quote يجب أن يكون نصًا موجودًا حرفيًا في النص الأصلي.",
    "- derived_quote يجب أن يكون نصًا موجودًا حرفيًا في النص المشتق، ويكون فارغًا إذا كان cls = missing.",
    "- اسأل ثلاثة أسئلة فقط: هل بقي الشرط؟ هل صحت النسبة؟ هل حفظت قوة الحكم؟",
    "- لا تفتِ، ولا ترجّح مذهبًا، ولا تحكم على صحة رأي، ولا تذكر حلالًا أو حرامًا.",
    "- إن لم تجد ما يخالف، أرجع findings فارغة. الامتناع مقبول وهو أفضل من التخمين.",
    "",
    `اللغة الهدف: ${ctx.language}`,
    `مستوى المحتوى: ${ctx.level}`,
    "",
    "النص الأصلي:",
    ctx.source,
    "",
    "النص المشتق:",
    ctx.derived,
  ].join("\n");
}

/** Pull the first JSON object out of a model reply that may add prose. */
function extractJson(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return raw;
  return raw.slice(start, end + 1);
}

function truncate(s: string): string {
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
}

/**
 * The model's own words for a claim the engine declined, so the rejection
 * carries what was claimed and not only that something was refused.
 */
function claimSuffix(f: Partial<SemanticRawFinding>): string {
  const note = typeof f.note === "string" ? f.note.trim() : "";
  if (note.length > 0) return ` ادعاء النموذج: «${truncate(note)}»`;
  const quote = typeof f.source_quote === "string" ? f.source_quote.trim() : "";
  if (quote.length > 0) return ` الاقتباس المذكور: «${truncate(quote)}»`;
  return "";
}

/**
 * The provider used when no model binding is available (browser, tests, a
 * static export). It produces no findings and says so — an absent layer must
 * never look like a passed layer.
 */
export function declaredGapProvider(reason: string): SemanticProvider {
  return {
    id: "declared-gap",
    async run(): Promise<
      LayerOutput & { model: string | null; promptHash: string | null; rejected: string[] }
    > {
      const coverage: CoverageNote[] = [
        {
          layer: "L3",
          kind: "condition",
          reason,
        },
      ];
      return { findings: [], coverage, checked: 0, model: null, promptHash: null, rejected: [] };
    },
  };
}

/** Provider backed by a real model call (Cloudflare Workers AI in production). */
export function modelProvider(caller: SemanticCaller): SemanticProvider {
  return {
    id: "model",
    async run(ctx: LayerContext) {
      const prompt = buildSemanticPrompt(ctx);
      const { raw, model, promptHash } = await caller(prompt, ctx);
      const { findings, rejected, invalid } = parseSemanticFindings(raw, ctx);

      // Every declined claim is named here, and this note travels into the
      // sealed record, so a reader sees what the model claimed and that the
      // engine refused it. A rejection is never a silent discard.
      const coverage: CoverageNote[] = [];
      if (invalid > 0 || rejected.length > 0) {
        coverage.push({
          layer: "L3",
          kind: "condition",
          reason:
            `رُفض ${Math.max(invalid, rejected.length)} ادعاءً من مخرج النموذج:` +
            " لا يُقبل كدليل إلا ما جُعل على مقطع محقق حرفيًا من الأصل ومقطع محقق حرفيًا من المشتق،" +
            " ولا يُقبل سؤال لا تحسمه النصوص (فالسند والغياب كذلك)." +
            ` التفصيل: ${rejected.join(" | ") || "—"}`,
        });
      }

      return {
        findings,
        coverage,
        checked: findings.length + invalid,
        model,
        promptHash,
        rejected,
      };
    },
  };
}
