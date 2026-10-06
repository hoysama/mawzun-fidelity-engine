/**
 * The verdict — one outcome, three states, computed by a fixed rule.
 *
 * This function is the whole reason the engine can promise reproducibility: the
 * model never reaches it. It receives findings that have already been located
 * and classifies them with the comparison below, so the same finding set always
 * yields the same verdict.
 *
 * States:
 * - `faithful`        — nothing in the bank drifted, and nothing material went
 *                       unchecked. A declared gap that touches the text blocks
 *                       this state: an unchecked quotation is not a passed one.
 * - `needs_revision`  — a drift was found, or a material gap prevents certifying.
 * - `refer`           — the system must not judge: level د, or nothing to judge with.
 *
 * Scope is always stated. When a layer did not run in this build, the verdict
 * says so in its reason rather than silently widening what it claims to cover.
 */

import type { AuditResult, ContentLevel, CoverageNote, Finding, LayerId, WorkType } from "./types";

export type VerdictState = AuditResult["verdict"];

const KIND_LABEL: Readonly<Record<string, string>> = {
  term: "المصطلح",
  ruling: "قوة الحكم",
  condition: "الشرط",
  restriction: "الحصر",
  isnad: "السند",
  number: "الأرقام",
  reference: "الإحالة",
  quote: "الاقتباس",
};

export function summariseLayers(
  findings: readonly Finding[],
  coverage: readonly CoverageNote[],
): { summary: Record<LayerId, { checked: number; shifted: number; missing: number }>; coverage: CoverageNote[] } {
  const summary: Record<LayerId, { checked: number; shifted: number; missing: number }> = {
    L1: { checked: 0, shifted: 0, missing: 0 },
    L2: { checked: 0, shifted: 0, missing: 0 },
    L3: { checked: 0, shifted: 0, missing: 0 },
  };

  for (const f of findings) {
    summary[f.layer].checked += 1;
    if (f.cls === "shifted") summary[f.layer].shifted += 1;
    if (f.cls === "missing") summary[f.layer].missing += 1;
  }

  return { summary, coverage: [...coverage] };
}

/** A quoted verse, marked with ornate brackets or with the ayah sign. */
export function hasQuranQuoteMarker(text: string): boolean {
  return /[\uFD3E\uFD3F\u06DE]/.test(text);
}

/**
 * A gap is material when it concerns something the text actually contains.
 * An unbound Qur'an corpus is harmless for a text with no quoted verse, and
 * fatal for one with a quotation — so a text carrying a verse can never be
 * certified while the corpus is unbound.
 *
 * Gaps that are merely scope — a layer that did not run in this build — do not
 * block the verdict; they are reported as scope in the reason and in the record,
 * so the verdict never claims more than was checked.
 */
export function materialGaps(
  coverage: readonly CoverageNote[],
  source: string,
  derived: string,
): CoverageNote[] {
  const quotesPresent = hasQuranQuoteMarker(source) || hasQuranQuoteMarker(derived);
  return coverage.filter((note) => note.kind === "quote" && quotesPresent);
}

/**
 * Parts of the check that did not run, named so the verdict states its scope.
 *
 * `reference`-kind notes are informational scope for the quotation check (how
 * many quotations were compared), not a part that failed to run, so they are
 * excluded from the reason. A `quote`-kind note is handled separately by
 * `materialGaps`, because it is a real gap for a text that carries a verse.
 */
export function scopeNotes(coverage: readonly CoverageNote[]): string[] {
  return coverage
    .filter((note) => note.kind !== "quote" && note.kind !== "reference")
    .map((note) => note.reason);
}

/** The operation's name as a reader sees it. */
const WORK_LABEL: Readonly<Record<string, string>> = {
  translate: "الترجمة",
  summarize: "التلخيص",
  paraphrase: "إعادة الصياغة",
};

/** The letters and digits of a text, so punctuation and layout are not read as content. */
const contentSize = (text: string): number => (text.match(/[\p{L}\p{N}]/gu) ?? []).length;

/**
 * Whether the derived text is too short for the operation it declares.
 *
 * Completeness is not a dimension this bank checks: the constraints verify the
 * presences they know about, not the absences they do not. So a translation that
 * drops a whole clause reaches the end looking clean, and «faithful» would read
 * as a clearance this engine never gave.
 *
 * The bound is a heuristic and the wording says so — it cannot name what was
 * lost, only refuse to vouch for what was never examined. A summary is held
 * loose because compressing is its purpose; a translation and a paraphrase are
 * held to carrying the whole.
 */
function completenessGap(workType: WorkType, source: string, derived: string): string | null {
  const sourceSize = contentSize(source);
  const derivedSize = contentSize(derived);
  // Below this the ratio says more about the text's brevity than about its content.
  if (sourceSize < 40) return null;

  const ratio = derivedSize / sourceSize;
  const floor = workType === "summarize" ? 0.1 : 0.45;
  if (ratio >= floor) return null;

  const percent = Math.round((1 - ratio) * 100);
  return (
    `الاكتمال بُعد غير مفحوص في هذا البنك: قيوده تتحقق من حضور ما تعرفه، لا من غياب ما لا تعرفه. ` +
    `والمشتق أقصر من الأصل بنحو ${percent}٪، وعمل «${WORK_LABEL[workType] ?? workType}» يعدّ بحمل الكل — ` +
    `فلا يُشهد له بالأمانة وهو بهذا النقص، ويحتاج مراجعة بشرية للاكتمال.`
  );
}

export function computeVerdict(
  level: ContentLevel,
  findings: readonly Finding[],
  coverage: readonly CoverageNote[],
  checkedTotal: number,
  source: string,
  derived: string,
  workType: WorkType = "translate",
): { verdict: VerdictState; reason: string } {
  const scope = scopeNotes(coverage);
  const scopeClause = scope.length > 0 ? ` نطاق الفحص في هذا التشغيل: ${scope.join(" ")}` : "";

  if (level === "D") {
    return {
      verdict: "refer",
      reason:
        "مستوى (د): فتوى أو حالة شخصية. هذا المستوى لا يُفحص ولا يُحكم فيه؛ النظام يوقف ويحيل إلى أهل العلم." +
        scopeClause,
    };
  }

  if (contentSize(source) > 0 && contentSize(derived) === 0) {
    return {
      verdict: "needs_revision",
      reason:
        "المشتق فارغ: لا يحمل أي نص، فلم يُنقل شيء من الأصل. كل عنصر مصدري مطبَّق يقابله الفراغ، فلا يُشهد للنقل بأمانة — القيود المصدرية المفحوصة مسجَّلة «مفقودة»، والفحص يحتاج إدخال النص المشتق الفعلي." +
        scopeClause,
    };
  }

  if (checkedTotal === 0) {
    return {
      verdict: "refer",
      reason:
        "لم يُطبَّق أي قيد من الحزمة العلمية على هذا المدخل، فلا يوجد ما يُحكم به. الوقف هنا نتيجة معتبرة لا فشل." +
        scopeClause,
    };
  }

  const shifted = findings.filter((f) => f.cls === "shifted");
  if (shifted.length > 0) {
    const kinds = [...new Set(shifted.map((f) => KIND_LABEL[f.kind] ?? f.kind))].join("، ");
    return {
      verdict: "needs_revision",
      reason: `رُصد انزياح في: ${kinds}. لكل موضع سببه ودليله في القائمة أدناه.` + scopeClause,
    };
  }

  const missing = findings.filter((f) => f.cls === "missing");
  if (missing.length > 0) {
    const kinds = [...new Set(missing.map((f) => KIND_LABEL[f.kind] ?? f.kind))].join("، ");
    return {
      verdict: "needs_revision",
      reason:
        `عناصر في الأصل لا يقابلها شيء في المشتق: ${kinds}. إسقاط العنصر تغيير في المعنى كما هو إقحامه.` +
        scopeClause,
    };
  }

  const gaps = materialGaps(coverage, source, derived);
  if (gaps.length > 0) {
    return {
      verdict: "needs_revision",
      reason:
        "النص يحمل اقتباسًا قرآنيًا غير مفحوص أو غير مربوط بموضع معتمد، فلا يصح اعتبار النقل أمينًا وهو غير مفحوص. التفصيل في ملاحظات التغطية." +
        scopeClause,
    };
  }

  // Before certifying, ask whether this run may certify at all. The constraints
  // that found nothing are silent about the dimension they never examined, and a
  // faithful verdict is a clearance a reader will act on.
  const gap = completenessGap(workType, source, derived);
  if (gap) {
    return { verdict: "needs_revision", reason: gap + scopeClause };
  }

  return {
    verdict: "faithful",
    reason:
      "لم يُرصد انزياح في أي قيد مطبَّق من الحزمة العلمية. أمانة النقل محفوظة في حدود القيود المعتمدة." + scopeClause,
  };
}
