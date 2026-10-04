/**
 * Layer 1 — deterministic checks, no model involved.
 *
 * What it covers: numerals, reference numbers, the narrated grade /
 * attribution markers declared in the bank, and — since retrieval was wired in
 * — the literal transmission of Qur'anic quotations. The first three are
 * presence-and-identity checks between the source and the derived text. The
 * quotation check is the package's binding rule «أهمية التأكد من توثيق نقل
 * الآيات» made machine-checkable: a quotation marked with the ornate brackets
 * ﴿…﴾ is located in the approved Hafs mushaf and compared letter for letter.
 *
 * Two rules keep the quotation check honest:
 *
 * - **Retrieval never decides.** The passage the comparison used is written
 *   into the finding's citation, and the classification is a function of the
 *   comparison, so a replay from the sealed record needs no network. A source
 *   that cannot be reached degrades the evidence into a coverage note; it never
 *   turns a quotation into a finding of drift.
 * - **Never invent the approved text.** Every passage attached here is what a
 *   connector returned. A quotation that cannot be located is reported as
 *   unlocatable, and explicitly not as wrong.
 *
 * Finding locations: a `missing` finding has no substring of the derived text
 * to point at, so its span is zero-length and sits at the first non-space
 * character of the derived text — the reviewer's reading start. The evidence
 * carries the source form that went missing.
 */

import type { Constraint, CoverageNote, Finding } from "./types";
import { findPhrase, normalizeWithMap } from "./normalize";
import { quoteKey } from "./rag";
import type { Citation } from "./rag-types";
import type { LayerContext, LayerOutput, QuoteLookup } from "./layer-context";

/**
 * The most distinct quotations one run will look up.
 *
 * A bounded ceiling is a product rule, not a tuning knob: the locator issues at
 * most three HTTP GETs per quotation (two search probes, one mushaf fetch), so
 * eight lookups cap the run at ~24 requests — well under the 60/minute limit
 * the connector enforces. Whatever is left over is reported as an unchecked
 * quotation rather than fetched.
 */
export const MAX_QURAN_LOOKUPS_PER_RUN = 8;

interface DigitRun {
  readonly value: string;
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

interface QuoteSpan {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

/** Read a digit as a plain decimal, accepting Arabic-Indic and Latin styles. */
function readDigit(ch: string): number | null {
  if (ch >= "0" && ch <= "9") return ch.charCodeAt(0) - 48;
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 0x0660 && code <= 0x0669) return code - 0x0660;
  if (code >= 0x06f0 && code <= 0x06f9) return code - 0x06f0;
  return null;
}

/** Every run of digits in `text`, read as a decimal value. */
export function extractDigits(text: string): DigitRun[] {
  const runs: DigitRun[] = [];
  let start = -1;
  let value = "";

  for (let i = 0; i <= text.length; i++) {
    const ch = text[i];
    const digit = ch === undefined ? null : readDigit(ch);
    if (digit !== null) {
      if (start < 0) start = i;
      value += String(digit);
      continue;
    }
    if (start >= 0) {
      runs.push({ value, start, end: i, text: text.slice(start, i) });
      start = -1;
      value = "";
    }
  }
  return runs;
}

/**
 * Every span enclosed in the ornate Qur'anic brackets ﴿…﴾.
 *
 * The brackets are the only deterministic way to tell a quotation from prose
 * that merely happens to share words with the Qur'an — without a delimiter, a
 * locator would start attributing ordinary sentences to ayat. Both bracket
 * members are accepted as opener or closer, because the pair is written in
 * either visual order across editions.
 */
const QURAN_QUOTE_RX = /[\uFD3E\uFD3F]([^\uFD3E\uFD3F]+)[\uFD3E\uFD3F]/g;

export function extractQuranQuotes(text: string): QuoteSpan[] {
  const out: QuoteSpan[] = [];
  let m: RegExpExecArray | null;
  QURAN_QUOTE_RX.lastIndex = 0;
  while ((m = QURAN_QUOTE_RX.exec(text)) !== null) {
    const inner = m[1];
    const start = m.index + 1;
    out.push({ text: inner, start, end: start + inner.length });
  }
  return out;
}

/** The first anchor a reviewer would look at when something is missing. */
function anchorFor(derived: string): number {
  const firstNonSpace = derived.search(/\S/);
  return firstNonSpace >= 0 ? firstNonSpace : 0;
}

function sourceForms(constraint: Constraint): string[] {
  return [...constraint.source].filter((f) => f.trim().length > 0).sort((a, b) => b.length - a.length);
}

function truncate(s: string): string {
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
}

/**
 * Does the approved passage carry this quotation verbatim?
 *
 * Equality (folding tashkeel and alef variants) is the strict case; containment
 * covers the normal case of a quotation that is one phrase of a longer ayah.
 * A changed or interpolated word fails both, which is exactly the drift the
 * layer exists to catch.
 */
function quoteIsVerbatim(quotation: string, approved: string): { equal: boolean; contained: boolean } {
  const q = quoteKey(quotation);
  if (q.length === 0) return { equal: false, contained: false };
  const a = quoteKey(approved);
  return { equal: q === a, contained: a.includes(q) };
}

// --- The operator-facing wording of every coverage note ---------------------

const NOTE_NO_RETRIEVER =
  "مطابقة النص القرآني حرفًا بحرف لم تُشغَّل في هذا التشغيل: لم يُمرَّر مسترجِع (retriever) يصل إلى المصحف المعتمد، فأي اقتباس قرآني في النص أو المشتق غير مفحوص. هذا حدّ مصرّح به، وليس حكمًا على الاقتباس.";

const quoteUnlocatedNote = (quotation: string): string =>
  `الاقتباس القرآني «${truncate(quotation)}» لم يُربط بأي موضع في المصحف المعتمد (حفص)، فلا يُنسب إلى آية بعينها. وهذا ليس حكمًا بأنه خطأ ولا بأنه ليس من القرآن، بل إعلان أن موضعه لم يُتحقق.`;

const quoteUnreachableNote = (quotation: string, detail: string): string =>
  `تعذّر الوصول إلى النص القرآني المعتمد لمطابقة الاقتباس «${truncate(quotation)}» من «الموسوعة القرآنية»؛ ${detail} الاقتباس في هذه الحالة غير مفحوص، وهذا ليس حكمًا بأنه خطأ.`;

const quoteMissingNote = (quotation: string): string =>
  `الأصل يحمل اقتباسًا قرآنيًا «${truncate(quotation)}» لا يحمله النص المشتق. إسقاط اقتباس آية تغيير فيما يكون النص دليلًا عليه.`;

const quoteBudgetNote = (cap: number): string =>
  `تجاوز عدد الاقتباسات القرآنية سقف المطابقة في التشغيل الواحد (${cap} اقتباسًا)؛ ما زاد عليه غير مفحوص. رُفع السقف عن قصد لحماية المصدر من سيل الطلبات.`;

const quoteRanNote = (marked: number, compared: number): string =>
  `نطاق فحص الاقتباس القرآني: وُسم في النصين ${marked} اقتباسًا بـ ﴿…﴾، وطوبق منها ${compared} على نص المصحف المعتمد (حفص) حرفًا بحرف. المقارنة جرت على النص المسترجع نفسه المحفوظ في السجل.`;

/**
 * The length of the longest run of characters two comparison keys share.
 *
 * Used to decide whether an unplaceable quotation is a corrupted version of a
 * verse the source quoted, or simply a phrase that is not from the Quran at all.
 * A changed word leaves most of the verse intact, so a long shared run separates
 * «this verse was altered» from «this is not a verse», which are different things
 * to tell a reviewer.
 */
function sharedRun(a: string, b: string): number {
  if (!a || !b) return 0;
  let best = 0;
  let previous = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const row = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        row[j] = previous[j - 1] + 1;
        if (row[j] > best) best = row[j];
      }
    }
    previous = row;
  }
  return best;
}

export async function runLayer1(ctx: LayerContext): Promise<LayerOutput> {
  const findings: Finding[] = [];
  const coverage: CoverageNote[] = [];
  let checked = 0;

  const script = ctx.language.toLowerCase().startsWith("ar") || ctx.language.toLowerCase().startsWith("ur")
    ? "arabic"
    : "latin";
  const derivedNorm = normalizeWithMap(ctx.derived, script);
  const sourceNorm = normalizeWithMap(ctx.source, "arabic");
  const anchor = anchorFor(ctx.derived);

  // --- Numerals -----------------------------------------------------------
  const derivedValues = new Set(extractDigits(ctx.derived).map((d) => d.value));
  const seen = new Set<string>();

  for (const run of extractDigits(ctx.source)) {
    if (seen.has(run.value)) continue;
    seen.add(run.value);
    checked++;

    if (derivedValues.has(run.value)) {
      findings.push({
        layer: "L1",
        constraintId: "number-reference",
        kind: "number",
        cls: "preserved",
        start: 0,
        end: 0,
        span: run.value,
        evidence: {
          source: run.text,
          derived: run.value,
          note: `الرقم «${run.value}» موجود في النصين بالقيمة نفسها.`,
        },
      });
    } else {
      findings.push({
        layer: "L1",
        constraintId: "number-reference",
        kind: "number",
        cls: "missing",
        start: anchor,
        end: anchor,
        span: "",
        evidence: {
          source: run.text,
          derived: "",
          note: `الرقم «${run.value}» موجود في الأصل وغير موجود في النص المشتق. أرقام الآيات والأحاديث والنسب تُقارن حرفياً.`,
        },
      });
    }
  }

  // --- Composite references (e.g. 2:255, 24.31) ---------------------------
  const derivedComposite = new Set<string>();
  const compositeRx = /\d+\s*[:.]\s*\d+/g;
  let cm: RegExpExecArray | null;
  while ((cm = compositeRx.exec(ctx.derived)) !== null) derivedComposite.add(cm[0].replace(/\s+/g, ""));

  const sourceCompositeRx = /\d+\s*[:.]\s*\d+/g;
  while ((cm = sourceCompositeRx.exec(ctx.source)) !== null) {
    const key = cm[0].replace(/\s+/g, "");
    checked++;
    if (!derivedComposite.has(key)) {
      findings.push({
        layer: "L1",
        constraintId: "number-reference",
        kind: "reference",
        cls: "missing",
        start: anchor,
        end: anchor,
        span: "",
        evidence: {
          source: cm[0],
          derived: "",
          note: "إحالة رقمية (سورة:آية أو نسبة) موجودة في الأصل وغير موجودة في المشتق.",
        },
      });
    }
  }

  // --- Isnad: narrated grade and attribution ------------------------------
  for (const constraint of ctx.bank.constraints) {
    if (constraint.kind !== "isnad") continue;

    const forms = sourceForms(constraint);
    const approved = constraint.approved[ctx.language] ?? [];

    const sourceHit = forms.find((form) => findPhrase(sourceNorm, ctx.source, form).length > 0);
    if (!sourceHit) continue;
    checked++;

    const approvedHit = approved
      .map((rendering) => findPhrase(derivedNorm, ctx.derived, rendering)[0])
      .find((match) => match !== undefined);

    if (approvedHit) {
      findings.push({
        layer: "L1",
        constraintId: constraint.id,
        kind: "isnad",
        cls: "preserved",
        start: approvedHit.start,
        end: approvedHit.end,
        span: approvedHit.text,
        evidence: {
          source: sourceHit,
          derived: approvedHit.text,
          note: `الدرجة أو الإحالة «${sourceHit}» نُقلت إلى المشتق بلفظ معتمد.`,
        },
      });
    } else {
      findings.push({
        layer: "L1",
        constraintId: constraint.id,
        kind: "isnad",
        cls: "missing",
        start: anchor,
        end: anchor,
        span: "",
        evidence: {
          source: sourceHit,
          derived: "",
          note: `الأصل يحمل «${sourceHit}» (درجة ثبوت أو إحالة)، والمشتق لا يحمل أي مقابل معتمد. نقل حديث بلا درجة ثبوته تغيير في قوة الاستدلال.`,
        },
      });
    }
  }

  // --- Qur'anic quotations: locate, then compare letter for letter ---------
  const quran = await checkQuranQuotations(ctx, findings, anchor);
  coverage.push(...quran.coverage);
  checked += quran.checked;

  return { findings, coverage, checked };
}

async function checkQuranQuotations(
  ctx: LayerContext,
  findings: Finding[],
  anchor: number,
): Promise<{ coverage: CoverageNote[]; checked: number }> {
  let quotationChecks = 0;
  const coverage: CoverageNote[] = [];
  const retriever = ctx.retriever;

  if (!retriever) {
    coverage.push({ layer: "L1", kind: "quote", reason: NOTE_NO_RETRIEVER });
    return { coverage, checked: 0 };
  }

  const derivedQuotes = extractQuranQuotes(ctx.derived);
  const sourceQuotes = extractQuranQuotes(ctx.source);
  const marked = new Set([...derivedQuotes, ...sourceQuotes].map((q) => quoteKey(q.text))).size;

  if (derivedQuotes.length === 0 && sourceQuotes.length === 0) {
    coverage.push({
      layer: "L1",
      kind: "reference",
      reason:
        "نطاق فحص الاقتباس القرآني: لم يُرصد أي اقتباس موسوم بـ ﴿…﴾ في النص الأصلي ولا في المشتق، فلم يُطلب أي نص من المصحف المعتمد.",
    });
    return { coverage, checked: 0 };
  }

  const derivedKey = quoteKey(ctx.derived);
  const cache = new Map<string, QuoteLookup>();
  let lookups = 0;
  let budgetHit = false;

  const lookup = async (quotation: string): Promise<{ value: QuoteLookup } | { budget: true }> => {
    const key = quoteKey(quotation);
    const hit = cache.get(key);
    if (hit) return { value: hit };
    if (lookups >= MAX_QURAN_LOOKUPS_PER_RUN) return { budget: true };
    lookups++;
    const value = await retriever.lookupQuote(quotation);
    cache.set(key, value);
    return { value };
  };

  // The derived text: every quotation it carries is a claim to be verified.
  let compared = 0;
  const derivedLocatedAyahs = new Set<string>();
  /**
   * Quotations the mushaf search could not place. A verse quoted with a changed
   * word exists nowhere in the approved text, so the search cannot find it — and
   * that is the case this check exists for. These are held back and judged
   * against the verses the source's own quotations located.
   */
  const deferredUnlocated: { text: string; start: number; end: number }[] = [];
  /** Verses located from the source's quotations: approved text plus its citation. */
  const sourceApproved: { approved: string; citation: Citation; where: string }[] = [];

  for (const quote of derivedQuotes) {
    const result = await lookup(quote.text);
    if ("budget" in result) {
      budgetHit = true;
      break;
    }
    quotationChecks++;
    const value = result.value;

    if (value.status === "unlocated") {
      // Not a verdict on its own: a verse quoted with a changed word exists
      // nowhere in the approved text, and that is exactly the case worth
      // catching. Deferred until the source's own quotations are located, so it
      // can be judged against the verse the source actually quoted.
      deferredUnlocated.push(quote);
      continue;
    }
    if (value.status === "unavailable") {
      coverage.push({ layer: "L1", kind: "quote", reason: quoteUnreachableNote(quote.text, value.note) });
      continue;
    }

    compared++;
    derivedLocatedAyahs.add(`${value.ayah.surah}:${value.ayah.ayah}`);
    const { equal, contained } = quoteIsVerbatim(quote.text, value.approved);
    const where = `${value.ayah.surah}:${value.ayah.ayah}`;

    if (equal || contained) {
      findings.push({
        layer: "L1",
        constraintId: null,
        kind: "quote",
        cls: "preserved",
        start: quote.start,
        end: quote.end,
        span: quote.text,
        evidence: {
          source: value.approved,
          derived: quote.text,
          note: equal
            ? `الاقتباس القرآني مطابق للنص المعتمد في ${where} (المصحف: حفص).`
            : `الاقتباس القرآني مطابق حرفًا بحرف لمقطع من الآية ${where} في المصحف المعتمد (حفص).`,
        },
        citations: [value.citation],
      });
    } else {
      findings.push({
        layer: "L1",
        constraintId: null,
        kind: "quote",
        cls: "shifted",
        start: quote.start,
        end: quote.end,
        span: quote.text,
        evidence: {
          source: value.approved,
          derived: quote.text,
          note: `الاقتباس القرآني لا يطابق النص المعتمد في ${where}. النص المعتمد: «${value.approved}» — المقتبس: «${quote.text}».`,
        },
        citations: [value.citation],
      });
    }
  }

  // The source text: a quotation it carries that the derived text does not is a
  // dropped verse — the text no longer stands as evidence for what it did.
  for (const quote of sourceQuotes) {
    const result = await lookup(quote.text);
    if ("budget" in result) {
      budgetHit = true;
      break;
    }
    quotationChecks++;
    const value = result.value;

    if (value.status === "unlocated") {
      coverage.push({ layer: "L1", kind: "quote", reason: quoteUnlocatedNote(quote.text) });
      continue;
    }
    if (value.status === "unavailable") {
      coverage.push({ layer: "L1", kind: "quote", reason: quoteUnreachableNote(quote.text, value.note) });
      continue;
    }

    sourceApproved.push({
      approved: value.approved,
      citation: value.citation,
      where: `${value.ayah.surah}:${value.ayah.ayah}`,
    });

    const carried = derivedKey.includes(quoteKey(quote.text));
    const sameAyahAsDerivedQuote = derivedLocatedAyahs.has(`${value.ayah.surah}:${value.ayah.ayah}`);
    if (!carried && !sameAyahAsDerivedQuote) {
      findings.push({
        layer: "L1",
        constraintId: null,
        kind: "quote",
        cls: "missing",
        start: anchor,
        end: anchor,
        span: "",
        evidence: {
          source: quote.text,
          derived: "",
          note: quoteMissingNote(quote.text),
        },
      });
    }
  }

  // A quotation the mushaf could not place, judged against the verses the source
  // itself quoted. A verse quoted with one changed word is not findable in the
  // approved text — the search has nothing to match — so without this pass the
  // strongest case this check exists for would be reported as merely unplaced,
  // and a corrupted verse is precisely what a reviewer needs flagged.
  for (const quote of deferredUnlocated) {
    const key = quoteKey(quote.text);
    let best: { approved: string; citation: Citation; where: string } | null = null;
    let bestScore = 0;
    for (const candidate of sourceApproved) {
      const score = sharedRun(key, quoteKey(candidate.approved)) / Math.max(1, key.length);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    if (best && bestScore >= 0.6) {
      findings.push({
        layer: "L1",
        constraintId: null,
        kind: "quote",
        cls: "shifted",
        start: quote.start,
        end: quote.end,
        span: quote.text,
        evidence: {
          source: best.approved,
          derived: quote.text,
          note: `الاقتباس القرآني في المشتق ليس نص المصحف، وهو قريب من الآية ${best.where} التي اقتبسها الأصل — أي أنه محرَّف عنها. المعتمد: «${best.approved}» — المقتبس: «${quote.text}».`,
        },
        citations: [best.citation],
      });
      continue;
    }

    coverage.push({ layer: "L1", kind: "quote", reason: quoteUnlocatedNote(quote.text) });
  }

  if (budgetHit) coverage.push({ layer: "L1", kind: "quote", reason: quoteBudgetNote(MAX_QURAN_LOOKUPS_PER_RUN) });

  coverage.push({ layer: "L1", kind: "reference", reason: quoteRanNote(marked, compared) });

  // The same quotation usually appears in both texts — that is what carrying a
  // verse across looks like — so each loop reports the same fact about it. Two
  // identical notes convey one thing, and a reader who meets the same sentence
  // twice stops trusting the length of the list.
  const unique = new Map<string, (typeof coverage)[number]>();
  for (const note of coverage) unique.set(`${note.layer}|${note.kind}|${note.reason}`, note);

  return { coverage: [...unique.values()], checked: quotationChecks };
}
