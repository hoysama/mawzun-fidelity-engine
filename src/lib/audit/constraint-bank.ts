/**
 * The constraint bank, imported from the approved scientific package.
 *
 * Nothing in this file is the system's opinion. Each entry carries an `origin`
 * naming the passage of the reference package it was imported from, so a
 * reviewer can open the package and check the rule. Where the package states a
 * usage rule without giving a complete list of renderings, the entry says so in
 * `rule` instead of inventing entries to fill the list.
 *
 * Source of the entries below: «المرجعية والحزمة العلمية والبيانات» — قسم
 * المعيار العلمي الملزم، وقسم أمثلة أسئلة اختبار سلامة المحتوى، وقسم نماذج
 * قاموس المصطلحات الأساسية.
 */

import type { Constraint, ConstraintBank } from "./types";
import { RULING_TERMS, RULING_POLICY_ORIGIN, forcesConflict } from "./ruling-strength";

const PACKAGE = "المرجعية والحزمة العلمية والبيانات — نطاق المحتوى المعتمد";

const GLOSSARY_ORIGIN = `${PACKAGE} — نماذج لقاموس المصطلحات الأساسية`;
const BEHAVIOUR_ORIGIN = `${PACKAGE} — أمثلة لأسئلة اختبار التأكد من سلامة المحتوى`;
const STANDARD_ORIGIN = `${PACKAGE} — المعيار العلمي الملزم لمخرجات الحلول`;

/** Glossary terms, with the usage rule the package states for each. */
export const TERM_CONSTRAINTS: readonly Constraint[] = [
  {
    id: "term-islam",
    kind: "term",
    source: ["الإسلام"],
    rule: "يبقى المصطلح، ويشرح بحسب السياق، ولا يختزل في مجرد اسم دين.",
    approved: { en: ["Islam"] },
    forbidden: { en: [] },
    origin: GLOSSARY_ORIGIN,
  },
  {
    id: "term-tawhid",
    kind: "term",
    source: ["التوحيد"],
    rule:
      "يفضل إبقاء المصطلح مع شرحه بالمعنى التعريفي، ويوصف بما جاء في الوحي من أسمائه الحسنى، ولا يختزل في مقابل عددي مجرد.",
    approved: { en: ["Tawhid", "Oneness of God", "the Oneness of God"] },
    forbidden: { en: [] },
    origin: GLOSSARY_ORIGIN,
  },
  {
    id: "term-ibadah",
    kind: "term",
    source: ["العبادة"],
    rule:
      "تشمل أعمال القلب والقول والعمل، ولا تختزل في الشعائر فقط. التعريف بالمفهوم بعبارة واضحة مع الحفاظ على المصطلح وذكر مرادفاته الدقيقة.",
    approved: { en: ["worship", "worship of God"] },
    forbidden: { en: ["rituals", "ritual practices"] },
    origin: `${GLOSSARY_ORIGIN} — ${BEHAVIOUR_ORIGIN}`,
  },
  {
    id: "term-sharia",
    kind: "term",
    source: ["الشريعة", "شريعة"],
    rule:
      "تشرح بحسب السياق، ولا تختزل في القانون الجنائي والعقوبات. المقابل المعتمد في القاموس مع شرح موجز عند عدم كفاية المقابل الحرفي.",
    approved: { en: ["Sharia", "Shariah", "Islamic law and guidance", "the Sharia"] },
    forbidden: { en: ["penal law", "criminal law", "Islamic penal code", "penal code"] },
    origin: `${GLOSSARY_ORIGIN} — ${BEHAVIOUR_ORIGIN}`,
  },
  {
    id: "term-hadith",
    kind: "term",
    source: ["الحديث", "حديث"],
    rule: "تُبين درجة الثبوت عند الاستدلال، ولا ينسب حديث دون التحقق من صحته.",
    approved: { en: ["Hadith", "hadith", "narration", "prophetic tradition"] },
    forbidden: { en: [] },
    origin: GLOSSARY_ORIGIN,
  },
  {
    id: "term-sunnah",
    kind: "term",
    source: ["السنة"],
    rule: "يحدد المقصود بحسب السياق العلمي: هدي النبي ﷺ وطريقته، أو ما يقابل البدعة.",
    approved: { en: ["Sunnah", "Sunnah of the Prophet", "prophetic practice"] },
    forbidden: { en: [] },
    origin: GLOSSARY_ORIGIN,
  },
  {
    id: "term-prophethood",
    kind: "term",
    source: ["النبوة"],
    rule: "تدل على اصطفاء الأنبياء بالوحي، مع التمييز بينها وبين القيادة البشرية الدينية.",
    approved: { en: ["Prophethood", "prophethood"] },
    forbidden: { en: [] },
    origin: GLOSSARY_ORIGIN,
  },
  {
    id: "term-revelation",
    kind: "term",
    source: ["الوحي"],
    rule: "يشرح بوصفه ما أوحاه الله إلى أنبيائه، ويتجنب استعماله بمعنى الإلهام الشخصي المضطرب.",
    approved: { en: ["Revelation", "revelation", "divine revelation"] },
    forbidden: { en: [] },
    origin: GLOSSARY_ORIGIN,
  },
  {
    id: "term-fatwa",
    kind: "term",
    source: ["الفتوى", "فتوى"],
    rule: "جواب شرعي يصدره مؤهل في واقعة أو سؤال، ولا يساوي المعلومة العامة.",
    approved: { en: ["fatwa", "Fatwa", "a fatwa", "religious verdict"] },
    forbidden: { en: ["opinion", "religious opinion", "personal view"] },
    origin: GLOSSARY_ORIGIN,
  },
  {
    id: "term-dawah",
    kind: "term",
    source: ["الدعوة"],
    rule: "تعريف بالإسلام والدعوة إليه بالحكمة، مع اختيار المقابل بحسب السياق والجمهور.",
    approved: { en: ["Dawah", "Da'wah", "dawah", "invitation to Islam", "calling to Islam"] },
    forbidden: { en: [] },
    origin: GLOSSARY_ORIGIN,
  },
];

/**
 * Isnad markers: a narration's grade or reference. The drift class is a
 * narration carried into the target text with its grade dropped.
 */
export const ISNAD_CONSTRAINTS: readonly Constraint[] = [
  {
    id: "isnad-grade",
    kind: "isnad",
    source: ["صحيح", "حسن", "ضعيف", "موضوع", "متفق عليه", "ثابت"],
    rule:
      "إذا نُقل حديث في النص المشتق وجب نقل درجة ثبوته معه؛ وإسقاط الدرجة تغيير في قوة الاستدلال. (المعيار: الموثوقية والإسناد)",
    approved: {
      en: [
        "sahih",
        "authentic",
        "hasan",
        "good",
        "da'if",
        "weak",
        "fabricated",
        "agreed upon",
        "sound",
        "established",
      ],
    },
    forbidden: { en: [] },
    origin: `${STANDARD_ORIGIN} — ${GLOSSARY_ORIGIN}`,
  },
  {
    id: "isnad-reference",
    kind: "isnad",
    source: ["رواه البخاري", "رواه مسلم", "أخرجه", "إسناده", "سنده", "في الصحيحين"],
    rule: "الإحالة إلى مصدر الحديث جزء من المعنى عند الاستدلال، وإسقاطها يُفقد الأثر قابلية التتبع.",
    approved: {
      en: [
        "al-Bukhari",
        "Bukhari",
        "Muslim",
        "reported by",
        "narrated by",
        "isnad",
        "chain of transmission",
        "Sahih al-Bukhari",
        "Sahih Muslim",
      ],
    },
    forbidden: { en: [] },
    origin: `${STANDARD_ORIGIN} — ${GLOSSARY_ORIGIN}`,
  },
];

/**
 * Condition markers: the words that carry the condition a ruling depends on.
 * The drift class is a condition dropped, which silently widens the ruling.
 */
export const CONDITION_CONSTRAINTS: readonly Constraint[] = [
  {
    id: "condition-marker",
    kind: "condition",
    source: ["بشرط", "إذا", "إن ", "ما لم", "ما دام", "بعد", "عند", "بدون", "بغير", "إلا", "حال"],
    rule:
      "الشرط الذي يتوقف عليه الحكم جزء من المعنى؛ وإسقاطه أو إسقاط أداته يوسّع الحكم بلا دليل. (المعيار: عدم إضافة معنى جديد)",
    approved: {
      en: [
        "provided that",
        "on condition that",
        "if",
        "unless",
        "as long as",
        "after",
        "when",
        "without",
        "except",
        "in the case of",
        "while",
      ],
    },
    forbidden: { en: [] },
    origin: `${STANDARD_ORIGIN} — ${BEHAVIOUR_ORIGIN}`,
  },
];

/** Numeric references: verse numbers, hadith numbers, counts. */
export const NUMBER_CONSTRAINTS: readonly Constraint[] = [
  {
    id: "number-reference",
    kind: "number",
    // Digits are matched as digits by layer 1, not as surface words, so this
    // entry carries no Arabic source form.
    source: [],
    rule: "أرقام الآيات والأحاديث والنسب تقارن حرفياً؛ اختلاف رقم أو إسقاطه تغيير في الإحالة.",
    approved: { en: [] },
    forbidden: { en: [] },
    origin: `${STANDARD_ORIGIN} — ${BEHAVIOUR_ORIGIN}`,
  },
];

/**
 * Ruling constraints, projected from the force table so display and check agree.
 *
 * `forbidden` is not hand-written: it is every rendering, in every language the
 * table carries, whose force conflicts with this one. That keeps one source of
 * truth — the force table — while the bank stays self-describing for a reviewer
 * reading it, and it is what makes "the ruling weakened" a lookup rather than a
 * model call.
 */
function rulingConstraints(): Constraint[] {
  return RULING_TERMS.map((term) => {
    const forbidden: Record<string, string[]> = {};
    for (const other of RULING_TERMS) {
      if (other.id === term.id) continue;
      if (!forcesConflict(term.force, other.force)) continue;
      for (const [language, renderings] of Object.entries(other.targets)) {
        forbidden[language] = [...(forbidden[language] ?? []), ...renderings];
      }
    }

    return {
      id: term.id,
      kind: "ruling" as const,
      source: term.arabic,
      rule: `قوة الحكم في المصدر: ${term.force}. يجب أن يحمل المقابل في اللغة الهدف القوة نفسها؛ وتحويل الحكم من ملزم إلى غير ملزم (أو العكس) انزياح.`,
      approved: term.targets as Record<string, string[]>,
      forbidden,
      origin: term.origin,
    };
  });
}

/**
 * The bank as a whole. `version` changes whenever any entry changes, and it
 * travels inside every audit record, so a record always names the exact bank
 * that produced it.
 */
export const CONSTRAINT_BANK_VERSION = "1.0.0";

export function buildConstraintBank(): ConstraintBank {
  return {
    version: CONSTRAINT_BANK_VERSION,
    packageName: PACKAGE,
    constraints: [
      ...TERM_CONSTRAINTS,
      ...ISNAD_CONSTRAINTS,
      ...CONDITION_CONSTRAINTS,
      ...NUMBER_CONSTRAINTS,
      ...rulingConstraints(),
    ],
  };
}

/** Language codes the bank currently carries renderings for. */
export function bankLanguages(bank: ConstraintBank): string[] {
  const codes = new Set<string>();
  for (const c of bank.constraints) {
    for (const code of Object.keys(c.approved)) codes.add(code);
    for (const code of Object.keys(c.forbidden)) codes.add(code);
  }
  return [...codes].sort();
}

export { RULING_POLICY_ORIGIN };
