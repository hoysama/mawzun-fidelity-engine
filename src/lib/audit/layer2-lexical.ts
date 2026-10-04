/**
 * Layer 2 — lexical checks: glossary terms, ruling force, and condition markers.
 *
 * All three run against tables imported from the scientific package, so this
 * layer is deterministic too — it is a lookup, not a judgement. It is a
 * separate layer from layer 1 because it works cross-language: layer 1 compares
 * the two texts as text, while layer 2 compares the source's *terms* against
 * the derived text's *renderings*.
 *
 * Alignment: a source occurrence has to be matched to a stretch of the derived
 * text before a rendering can be judged in context. Two methods are used, and
 * the finding says which one produced it:
 *
 * - `ordinal` — source and derived have the same number of sentences; the
 *   aligned sentence index is used directly. Exact for short texts.
 * - `proportional` — otherwise, the source occurrence's relative position is
 *   mapped onto the derived text. An approximation, and labelled as one.
 *
 * Presence is checked document-wide before location is resolved in the aligned
 * sentence, so an alignment error can move where a finding points but cannot
 * invent a false "missing".
 */

import type { Constraint, CoverageNote, Finding } from "./types";
import { findPhrase, normalizeWithMap, arabicKey } from "./normalize";
import { packageCitation } from "./rag";
import { FORCE_PROFILES, forcesConflict, RULING_TERMS, type RulingForce } from "./ruling-strength";
import type { LayerContext, LayerOutput } from "./layer-context";

export type AlignmentKind = "ordinal" | "proportional";

export interface Layer2Output extends LayerOutput {
  readonly alignment: AlignmentKind;
}

export interface Segment {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

const SENTENCE_END = new Set(["\n", ".", "!", "?", "\u061F", "\u06D4"]);

/** Split into sentences, keeping each segment's offsets in the original text. */
export function segmentText(text: string): Segment[] {
  const out: Segment[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    if (!SENTENCE_END.has(text[i])) continue;
    const end = i + 1;
    const slice = text.slice(start, end);
    if (slice.trim().length > 0) out.push({ text: slice, start, end });
    start = end;
  }
  if (start < text.length) {
    const slice = text.slice(start);
    if (slice.trim().length > 0) out.push({ text: slice, start, end: text.length });
  }
  return out;
}

function alignIndex(
  sourceSegs: readonly Segment[],
  derivedSegs: readonly Segment[],
  sourceSeg: Segment,
  sourceIndex: number,
  sourceLength: number,
  derivedLength: number,
): { index: number; kind: AlignmentKind } {
  if (derivedSegs.length === 0) return { index: -1, kind: "proportional" };
  if (sourceSegs.length === derivedSegs.length) {
    return { index: Math.min(sourceIndex, derivedSegs.length - 1), kind: "ordinal" };
  }

  const ratio = sourceLength > 0 ? sourceSeg.start / sourceLength : 0;
  const target = Math.min(derivedLength - 1, Math.max(0, Math.round(ratio * derivedLength)));
  let best = 0;
  for (let i = 0; i < derivedSegs.length; i++) {
    if (derivedSegs[i].start <= target) best = i;
    else break;
  }
  return { index: best, kind: "proportional" };
}

function formsOf(constraint: Constraint): string[] {
  return [...constraint.source].filter((f) => f.trim().length > 0).sort((a, b) => b.length - a.length);
}

/**
 * The alef letters of a raw Arabic string, keeping each letter's identity.
 *
 * `normalizeWithMap` folds أ/إ/آ/ٱ to a bare alef so sloppier input still matches
 * a glossary term — right for content words, wrong for the one- and two-letter
 * function words. The conditional «إن» and the emphatic «أن» collapse to the same
 * key, so «والمسلم يعتقد أن الله واحد» was reported as carrying a condition that
 * the sentence does not have. Comparing the raw letters of a condition marker
 * restores the distinction without touching the shared normalizer, which every
 * other layer depends on.
 */
const ALEF_LIKE = /[\u0623\u0625\u0622\u0671\u0627]/g;

function alefSignature(raw: string): string {
  return (raw.match(ALEF_LIKE) ?? []).map((ch) => (ch === "\u0627" ? "-" : ch)).join("");
}

/** The word immediately before `index`, skipping spaces. */
function precedingWord(text: string, index: number): string {
  let i = index - 1;
  while (i >= 0 && /\s/.test(text[i])) i--;
  const end = i + 1;
  while (i >= 0 && !/[\s\u060C\u061B.,;:!?()«»\[\]{}"']/.test(text[i])) i--;
  return text.slice(i + 1, end);
}

/**
 * The character ranges an author marked as a quotation with the ornate brackets
 * ﴿…﴾.
 *
 * A quoted verse is verified letter for letter by the Quranic quotation check in
 * layer 1, which owns that span and cites the ayah it matched. Layer 2 reads the
 * same text as ordinary content, and without this the two layers disagree about
 * one span: the emphatic «إِنَّ» in «إِنَّ اللَّهَ مَعَ الصَّابِرِينَ» is a
 * particle a translation is not obliged to carry, and reporting it as a dropped
 * condition makes a faithful run look like drifting.
 */
function quotedSpans(text: string): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "﴿") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === "﴾" && depth > 0) {
      depth -= 1;
      if (depth === 0) spans.push({ start, end: i + 1 });
    }
  }
  if (depth > 0) spans.push({ start, end: text.length });
  return spans;
}

/** Whether a position in the source falls inside one of the marked quotations. */
function insideQuote(spans: readonly { start: number; end: number }[], index: number): boolean {
  return spans.some((span) => index >= span.start && index < span.end);
}

export function runLayer2(ctx: LayerContext): Layer2Output {
  const findings: Finding[] = [];
  const coverage: CoverageNote[] = [];
  let checked = 0;
  let alignmentKind: AlignmentKind = "proportional";

  const script =
    ctx.language.toLowerCase().startsWith("ar") || ctx.language.toLowerCase().startsWith("ur")
      ? "arabic"
      : "latin";

  const sourceNorm = normalizeWithMap(ctx.source, "arabic");
  const derivedNorm = normalizeWithMap(ctx.derived, script);
  const sourceSegs = segmentText(ctx.source);
  const derivedSegs = segmentText(ctx.derived);
  const sourceQuotes = quotedSpans(ctx.source);
  const quotedKinds = new Set<Constraint["kind"]>(["condition", "ruling"]);

  for (const constraint of ctx.bank.constraints) {
    if (constraint.kind !== "term" && constraint.kind !== "ruling" && constraint.kind !== "condition") {
      continue;
    }

    const approved = constraint.approved[ctx.language] ?? [];
    const forbidden = constraint.forbidden[ctx.language] ?? [];
    const forms = formsOf(constraint);

    // Gather every source match for every surface form, then drop the ones that
    // sit inside a longer match. Without this, «يجوز» matches inside «لا يجوز»
    // and one negation produces two contradictory findings.
    // A shorter form inside a negated longer one must not produce its own
    // finding: «يجوز» sits inside «لا يجوز», and reading it separately turns one
    // prohibition into an extra, contradictory permission finding.
    const NEGATORS = new Set(["لا", "لم", "لن", "ما", "غير", "ليس"]);
    const candidates: { form: string; match: ReturnType<typeof findPhrase>[number] }[] = [];
    for (const form of forms) {
      const firstToken = form.trim().split(/\s+/)[0] ?? "";
      const isNegatorItself = NEGATORS.has(arabicKey(firstToken));
      // Condition markers are the only forms short and grammatical enough that
      // folding the alefs changes which word they are; see `alefSignature`.
      const strictAlef = constraint.kind === "condition";
      const formSignature = strictAlef ? alefSignature(form) : "";
      for (const match of findPhrase(sourceNorm, ctx.source, form)) {
        if (strictAlef && alefSignature(match.text) !== formSignature) continue;
        // A span the author marked as a quotation belongs to the Quranic
        // quotation check in layer 1, which verifies it letter for letter.
        // Reading it again as ordinary content invents findings about text that
        // is already checked: the emphatic «إِنَّ» in «إِنَّ اللَّهَ مَعَ
        // الصَّابِرِينَ» is not a condition a translation dropped, and a
        // faithful run must not be reported as drifting because of it.
        if (quotedKinds.has(constraint.kind) && insideQuote(sourceQuotes, match.start)) continue;
        if (
          constraint.kind === "ruling" &&
          !isNegatorItself &&
          NEGATORS.has(arabicKey(precedingWord(ctx.source, match.start)))
        ) {
          continue;
        }
        candidates.push({ form, match });
      }
    }
    candidates.sort((a, b) => b.match.end - b.match.start - (a.match.end - a.match.start));

    const accepted: typeof candidates = [];
    for (const candidate of candidates) {
      const overlaps = accepted.some(
        (a) => candidate.match.start < a.match.end && a.match.start < candidate.match.end,
      );
      if (!overlaps) accepted.push(candidate);
    }
    accepted.sort((a, b) => a.match.start - b.match.start);

    for (const { form, match: sm } of accepted) {
        checked++;

        const segIdx = sourceSegs.findIndex((s) => sm.start >= s.start && sm.start < s.end);
        const { index: derivedIdx, kind } = alignIndex(
          sourceSegs,
          derivedSegs,
          segIdx >= 0 ? sourceSegs[segIdx] : { text: "", start: sm.start, end: sm.end },
          segIdx >= 0 ? segIdx : 0,
          ctx.source.length,
          ctx.derived.length,
        );
        if (kind === "ordinal") alignmentKind = "ordinal";

        const window = derivedIdx >= 0 ? derivedSegs[derivedIdx] : null;

        // Forbidden first: a matching approved rendering must never mask a
        // forbidden one that sits in the same sentence.
        const forbiddenInWindow = window
          ? firstMatch(forbidden, derivedNorm, ctx.derived, window)
          : null;
        const forbiddenAnywhere = forbiddenInWindow ?? firstMatch(forbidden, derivedNorm, ctx.derived, null);
        const approvedInWindow = window ? firstMatch(approved, derivedNorm, ctx.derived, window) : null;
        const approvedAnywhere = approvedInWindow ?? firstMatch(approved, derivedNorm, ctx.derived, null);

        if (constraint.kind === "ruling") {
          const sourceForce = forceOf(constraint.id);
          // Read the rendering that actually appears, longest first, so
          // "not recommended" is read as one phrase carrying the dislike force
          // rather than as "recommended" with a negation the matcher never sees.
          const union = [...new Set([...approved, ...forbidden])];
          const inWindow = window ? firstMatch(union, derivedNorm, ctx.derived, window) : null;
          const anywhere = inWindow ?? firstMatch(union, derivedNorm, ctx.derived, null);

          if (!anywhere) {
            findings.push({
              layer: "L2",
              constraintId: constraint.id,
              kind: "ruling",
              cls: "missing",
              start: window ? window.start : 0,
              end: window ? window.start : 0,
              span: "",
              evidence: {
                source: form,
                derived: "",
                note: `لفظ الحكم «${form}» موجود في الأصل، ولا يقابله في المشتق لفظ من الجدول يحمل أي قوة حكم. يحتاج مراجعة بشرية.`,
              },
            });
            continue;
          }

          const targetForce = forceForRendering(anywhere.text, ctx.language);
          if (targetForce === null) {
            coverage.push({
              layer: "L2",
              kind: "ruling",
              reason: `لفظ الحكم «${anywhere.text}» مستخدم في المشتق ولا تعرفه قوة الحكم في الجدول، فلم يُصنَّف. يحتاج إضافة إلى السياسة أو مراجعة بشرية.`,
            });
            continue;
          }

          findings.push({
            layer: "L2",
            constraintId: constraint.id,
            kind: "ruling",
            cls: forcesConflict(sourceForce, targetForce) ? "shifted" : "preserved",
            start: anywhere.start,
            end: anywhere.end,
            span: anywhere.text,
            evidence: {
              source: form,
              derived: anywhere.text,
              note: buildForceNote(
                sourceForce,
                targetForce,
                form,
                anywhere.text,
                inWindow ? kind : "proportional",
              ),
            },
          });
          continue;
        }

        if (forbiddenAnywhere) {
          findings.push({
            layer: "L2",
            constraintId: constraint.id,
            kind: constraint.kind,
            cls: "shifted",
            start: forbiddenAnywhere.start,
            end: forbiddenAnywhere.end,
            span: forbiddenAnywhere.text,
            evidence: {
              source: form,
              derived: forbiddenAnywhere.text,
              note: `«${form}» نُقل بمقابل تُمنعه الحزمة العلمية: «${forbiddenAnywhere.text}». القاعدة: ${constraint.rule}`,
            },
          });
          continue;
        }

        if (approvedAnywhere) {
          findings.push({
            layer: "L2",
            constraintId: constraint.id,
            kind: constraint.kind,
            cls: "preserved",
            start: approvedAnywhere.start,
            end: approvedAnywhere.end,
            span: approvedAnywhere.text,
            evidence: {
              source: form,
              derived: approvedAnywhere.text,
              note: `«${form}» نُقل بمقابل معتمد.`,
            },
          });
          continue;
        }

        // No rendering from either list was found. For terms whose approved
        // list is populated this is a real gap; for terms whose list is empty
        // the package states a rule without a rendering list, so the run
        // records a coverage note instead of a finding.
        if (approved.length === 0) {
          coverage.push({
            layer: "L2",
            kind: constraint.kind,
            reason: `المصطلح «${form}» موجود في الأصل، والحزمة تنص على قاعدته دون قائمة مقابلات معتمدة («${constraint.id}»). لم يُفحص نقله.`,
          });
          continue;
        }

        findings.push({
          layer: "L2",
          constraintId: constraint.id,
          kind: constraint.kind,
          cls: "missing",
          start: window ? window.start : 0,
          end: window ? window.start : 0,
          span: "",
          evidence: {
            source: form,
            derived: "",
            note: `«${form}» موجود في الأصل، ولا يظهر له في المشتق أي مقابل من المقابلات المعتمدة.`,
          },
        });
    }
  }

  // Attach each finding's own rule and approved renderings as its citation,
  // from the shipped package (local, so no network call and no per-constraint
  // fan-out). The timestamp is pinned to the run's `now` so a fixed-time run
  // seals an identical record, which is what makes a replay reproducible.
  const now = ctx.now ?? new Date().toISOString();
  const constraintById = new Map(ctx.bank.constraints.map((c) => [c.id, c]));
  const cited: Finding[] = findings.map((finding) => {
    if (!finding.constraintId) return finding;
    const constraint = constraintById.get(finding.constraintId);
    if (!constraint) return finding;
    const approved = constraint.approved[ctx.language] ?? [];
    const citations = packageCitation(constraint.id, constraint.rule, approved).citations.map((c) => ({
      ...c,
      retrievedAt: now,
    }));
    return { ...finding, citations };
  });

  return { findings: cited, coverage, checked, alignment: alignmentKind };
}

function firstMatch(
  renderings: readonly string[],
  derivedNorm: ReturnType<typeof normalizeWithMap>,
  derived: string,
  window: Segment | null,
): { start: number; end: number; text: string } | null {
  // Longest rendering first, so "not permitted" wins over "permitted" and
  // "not recommended" over "recommended".
  const sorted = [...renderings].sort((a, b) => b.length - a.length);
  for (const rendering of sorted) {
    for (const m of findPhrase(derivedNorm, derived, rendering)) {
      if (window && (m.start < window.start || m.start >= window.end)) continue;
      return { start: m.start, end: m.end, text: m.text };
    }
  }
  return null;
}

/** Force of a ruling constraint derived from its id. */
function forceOf(constraintId: string): RulingForce {
  const term = RULING_TERMS.find((t) => t.id === constraintId);
  return term ? term.force : "permission";
}

/** Force that a rendering belongs to, if the table knows it. */
function forceForRendering(rendering: string, language: string): RulingForce | null {
  const norm = rendering.trim().toLowerCase();
  for (const term of RULING_TERMS) {
    const list = term.targets[language] ?? [];
    if (list.some((r) => r.toLowerCase() === norm)) return term.force;
  }
  // Fall back to a substring test, since the reported span may include
  // surrounding punctuation that the finder kept.
  for (const term of RULING_TERMS) {
    const list = term.targets[language] ?? [];
    if (list.some((r) => norm.includes(r.toLowerCase()))) return term.force;
  }
  return null;
}

function buildForceNote(
  sourceForce: RulingForce,
  targetForce: RulingForce,
  sourceForm: string,
  targetSpan: string,
  alignmentKind: AlignmentKind,
): string {
  if (!forcesConflict(sourceForce, targetForce)) {
    return `«${sourceForm}» نُقل بمقابل «${targetSpan}»، والحكم لم يتغير في قوته. المحاذاة: ${alignmentKind}.`;
  }
  const a = FORCE_PROFILES[sourceForce];
  const b = FORCE_PROFILES[targetForce];
  const kindOfChange = a.binding !== b.binding ? "تغيّر في الإلزام" : "تغيّر في الاتجاه";
  return `«${sourceForm}» قوته في الأصل «${a.label}» (${a.binding ? "ملزم" : "غير ملزم"})، ونُقل إلى «${targetSpan}» وقوته «${b.label}» (${b.binding ? "ملزم" : "غير ملزم"}). ${kindOfChange} — الحكم تغيّر وإن كانت اللغة سليمة. المحاذاة: ${alignmentKind}.`;
}
