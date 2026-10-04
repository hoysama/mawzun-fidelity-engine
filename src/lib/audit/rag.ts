/**
 * The retrieval connectors.
 *
 * Read `rag-types.ts` first: it explains why retrieval here is live rather than
 * an index, and why a citation can never move a verdict.
 *
 * Every connector obeys the source's own published policy:
 *  - Quranpedia's usage policy permits live queries and forbids bulk download and
 *    re-publication, and asks for 120 requests/minute at most. We query live, we
 *    store nothing, and the limiter below is set below their ceiling on purpose.
 *  - dawa.center's robots.txt disallows its storage, download, preview and search
 *    paths; those are refused here by construction.
 *  - The three sources that answer automated clients with 403 are declared
 *    unreachable with the measured status rather than being quietly absent.
 */

import { normalizeWithMap } from "./normalize";
import type { Citation, CitationKind, RetrievalOutcome, SourceId, SourceStatus } from "./rag-types";

export const QURANPEDIA_BASE = "https://api.quranpedia.net/v1";
export const QURANPEDIA_SITE = "https://quranpedia.net";

/** The mushaf the package's rule points at: Hafs, King Fahd Complex edition. */
export const HAFS_MUSHAF_ID = 1;

/** Below the published 120/minute ceiling, and counted per run. */
const MAX_REQUESTS_PER_MINUTE = 60;
const REQUEST_TIMEOUT_MS = 12_000;

const LABELS: Record<SourceId, string> = {
  quranpedia: "الموسوعة القرآنية",
  dawa: "الموسوعة الدعوية الرقمية",
  package: "المرجعية والحزمة العلمية والبيانات",
  dorar: "الدرر السنية",
  shamela: "المكتبة الشاملة",
  "islamic-content": "موسوعة المجرة",
};

/**
 * The measured state of every approved source, from a probe run in this
 * environment. Kept here rather than in a document because the audit reports it:
 * a reviewer sees which sources fed the result and which could not be reached.
 */
export const SOURCE_STATUSES: readonly SourceStatus[] = [
  {
    id: "quranpedia",
    label: LABELS.quranpedia,
    address: "quranpedia.net",
    rule: "نص القرآن بالرسم والنص المعتمد، وترجماته المعتمدة (لكل لغة مستخدمة) — أهمية التأكد من توثيق نقل الآيات.",
    kind: "live-api",
    httpStatus: 200,
    detail: "واجهة برمجية عامة موثّقة بلا مصادقة، بسقف 120 طلبًا في الدقيقة. تُستجوَب حيّاً ولا يُخزَّن منها شيء، امتثالًا لسياستها التي تنص أن الواجهة ليست خدمة تنزيل.",
  },
  {
    id: "dawa",
    label: LABELS.dawa,
    address: "dawa.center",
    rule: "يُوصى بالرجوع إليه فيما يحتاج إليه في الدعوة إلى الله، بحسب اللغات والأديان والفئات والبلدان.",
    kind: "live-fetch",
    httpStatus: 200,
    detail: "صفحات المحتوى مسموحة بموجب robots.txt؛ المسارات /storage/files/ و/*/download و/*/preview و/search ممنوعة صراحةً ويرفضها الموصل قبل الإرسال.",
  },
  {
    id: "package",
    label: LABELS.package,
    address: "مستند الحزمة المشحون في المستودع",
    rule: "الحزمة العلمية المعتمدة: المصطلحات وقواعد استخدامها، والمعيار الملزم، وأمثلة أسئلة سلامة المحتوى.",
    kind: "local-package",
    httpStatus: null,
    detail: "لا تحتاج شبكة؛ بنك القيود مستورد منها، وكل قيد يحمل حقل origin يسمّي القسم الذي جاء منه.",
  },
  {
    id: "dorar",
    label: LABELS.dorar,
    address: "dorar.net",
    rule: "التفسير والعقيدة والفقه والسيرة والحديث: مصادر معتمدة، مع تمييز كلام المفسر، وعدم نقل حديث بلا درجة ثبوت.",
    kind: "unreachable",
    httpStatus: 403,
    detail: "ترد 403 على العميل الآلي حتى بترويسات متصفح كاملة (اختُبر على tafseer/hadith/aqeeda/feqhia/history). تحتاج تحققًا بشريًا أو مسارًا مرخّصًا؛ لم يُختلق لها بديل.",
  },
  {
    id: "shamela",
    label: LABELS.shamela,
    address: "shamela.ws",
    rule: "الطبعات المعتمدة لكتب السنة، ولا يُنسب حديث بلا مصدر.",
    kind: "unreachable",
    httpStatus: 403,
    detail: "ترد 403 على العميل الآلي. لا تُخزَّن نسخة منها.",
  },
  {
    id: "islamic-content",
    label: LABELS["islamic-content"],
    address: "islamic-content.com",
    rule: "معجم مصطلحات الترجمة: يتقدّم على الترجمة التقليدية في المصطلحات الشرعية الحساسة.",
    kind: "unreachable",
    httpStatus: 403,
    detail: "ترد 403 على العميل الآلي (بما فيها /dictionary). المقابلات المعتمدة المتوفرة لدينا تأتي من حزمة الجهة المنظمة، وهي مُعلَّمة بذلك في بنك القيود.",
  },
];

let windowStart = 0;
let windowCount = 0;

/** A conservative limiter: a burst cap per rolling minute, never a queue. */
function allowRequest(): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  if (windowCount >= MAX_REQUESTS_PER_MINUTE) return false;
  windowCount += 1;
  return true;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * One GET, with a timeout and no retry storm.
 *
 * A source that is slow or refusing must degrade the evidence, not stall the
 * audit, so this returns null rather than throwing: the caller turns that into a
 * coverage note.
 */
async function getJson(url: string): Promise<unknown | null> {
  if (!allowRequest()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function cite(
  sourceId: SourceId,
  url: string,
  passage: string,
  kind: CitationKind,
  ayah?: { surah: number; ayah: number },
): Promise<Citation> {
  return {
    sourceId,
    label: LABELS[sourceId],
    url,
    retrievedAt: new Date().toISOString(),
    hash: await sha256Hex(passage),
    passage,
    kind,
    ayah,
  };
}

/**
 * Retrieval runs on the server. In the browser fallback the engine still runs,
 * but it cannot reach these sources, and it says so instead of pretending the
 * citation step found nothing to report.
 */
function browserDeclaredGap(what: string): RetrievalOutcome | null {
  if (typeof window === "undefined") return null;
  return {
    citations: [],
    note: `${what}: الاسترجاع يعمل على الخادم وحده، وهذا التشغيل جرى في المتصفح فلا استشهاد من المصادر المعتمدة.`,
  };
}

/** The approved Quranic text for one ayah, from the Hafs mushaf. */
export async function fetchQuranAyah(surah: number, ayah: number): Promise<RetrievalOutcome> {
  const gap = browserDeclaredGap("النص القرآني المعتمد");
  if (gap) return gap;
  const url = `${QURANPEDIA_BASE}/mushafs/${HAFS_MUSHAF_ID}/${surah}/${ayah}`;
  const data = (await getJson(url)) as { text?: string } | null;
  if (!data?.text) {
    return { citations: [], note: `تعذّر الوصول إلى النص القرآني المعتمد للآية ${surah}:${ayah} من «${LABELS.quranpedia}»؛ الاقتباس القرآني في هذه الحالة غير مفحوص.` };
  }
  return {
    citations: [await cite("quranpedia", url, data.text, "quran", { surah, ayah })],
  };
}

/** The approved translations of one ayah for a target language. */
export async function fetchQuranTranslation(
  surah: number,
  ayah: number,
  language: string,
): Promise<RetrievalOutcome> {
  const gap = browserDeclaredGap("الترجمات المعتمدة");
  if (gap) return gap;
  const url = `${QURANPEDIA_BASE}/translations/${surah}/${ayah}/${encodeURIComponent(language)}`;
  const data = (await getJson(url)) as { book?: { name?: string }; "translation-content"?: string }[] | null;
  if (!Array.isArray(data) || data.length === 0) {
    return { citations: [], note: `لا ترجمة معتمدة متاحة للآية ${surah}:${ayah} باللغة «${language}» في «${LABELS.quranpedia}».` };
  }
  const first = data.find((row) => row["translation-content"]);
  if (!first?.["translation-content"]) {
    return { citations: [], note: `ردّ «${LABELS.quranpedia}» بلا نص ترجمة للآية ${surah}:${ayah}.` };
  }
  return {
    citations: [
      await cite(
        "quranpedia",
        url,
        first["translation-content"],
        "translation",
        { surah, ayah },
      ),
    ],
  };
}

/**
 * Where does this quotation sit in the Quran?
 *
 * The package's binding rule is «أهمية التأكد من توثيق نقل الآيات», and this is
 * what makes it machine-checkable: a quotation found in the derived text can be
 * located in the approved mushaf, and then compared letter by letter. A quotation
 * that cannot be located is reported as unlocatable, not as wrong.
 *
 * The search endpoint's documented types are books, fatwas, notes and topics; the
 * `ayahs` type also answers and is the only way to locate a verse, so it is used
 * with the match verified locally: a returned ayah is accepted only when the
 * quotation really sits inside it. Without that check the first hit of a substring
 * search would be reported as the quotation's home, which is how a locator starts
 * inventing attributions.
 */
export async function locateAyahForQuote(
  quote: string,
): Promise<{ surah: number; ayah: number; text: string } | null> {
  if (typeof window !== "undefined") return null;
  const trimmed = quote.trim();
  if (trimmed.length < 8) return null;

  const keys = new Set<string>();
  const add = (candidate: string) => {
    const key = quoteKey(candidate);
    if (key.length >= 8) keys.add(key);
  };
  add(trimmed);
  add(trimmed.split(/\s+/).slice(0, 4).join(" "));

  for (const query of [trimmed, trimmed.split(/\s+/).slice(0, 3).join(" ")]) {
    if (query.trim().length < 3) continue;
    const url = `${QURANPEDIA_BASE}/search/${encodeURIComponent(query)}/ayahs`;
    const data = (await getJson(url)) as { items?: unknown } | null;
    const items = Array.isArray(data?.items) ? (data.items as Record<string, unknown>[]) : [];
    for (const row of items) {
      const surah = Number(row.surah);
      const ayah = Number(row.number ?? row.ayah);
      const text = typeof row.text === "string" ? row.text : "";
      if (!Number.isFinite(surah) || !Number.isFinite(ayah) || !text) continue;
      const ayahKey = quoteKey(text);
      for (const key of keys) {
        // Accept only a real containment in either direction: a short searching
        // fragment inside the ayah, or a whole ayah quoted inside a longer span.
        if (ayahKey.includes(key) || key.includes(ayahKey)) {
          return { surah, ayah, text };
        }
      }
    }
  }
  return null;
}

/** The approved renderings and rule for a constraint, from the shipped package. */
export function packageCitation(
  constraintId: string,
  rule: string,
  approved: readonly string[],
): RetrievalOutcome {
  const passage = approved.length > 0
    ? `${rule} — المقابلات المعتمدة: ${approved.join(" · ")}`
    : rule;
  // The package is held locally, so this citation is synchronous in substance
  // but the same shape as the network ones so the UI renders one thing.
  return {
    citations: [
      {
        sourceId: "package",
        label: LABELS.package,
        url: "islamic_ai_hackathon.pdf",
        retrievedAt: new Date().toISOString(),
        hash: "",
        passage,
        kind: "glossary",
      },
    ],
    note: approved.length === 0
      ? `القيد «${constraintId}»: الحزمة تنص على القاعدة دون قائمة مقابلات معتمدة، فالاستشهاد بالقاعدة وحدها.`
      : undefined,
  };
}

/** The citation rows for a Quranic span the audit found in a text. */
export async function citationsForQuranicSpan(
  span: string,
): Promise<RetrievalOutcome> {
  const located = await locateAyahForQuote(span);
  if (!located) {
    return {
      citations: [],
      note: `«${span}» يشبه اقتباسًا قرآنيًا ولم يُوجد في «${LABELS.quranpedia}»، فلا يُنسب إلى موضع بعينه.`,
    };
  }
  const url = `${QURANPEDIA_BASE}/mushafs/${HAFS_MUSHAF_ID}/${located.surah}/${located.ayah}`;
  return {
    citations: [
      await cite("quranpedia", url, located.text, "quran", {
        surah: located.surah,
        ayah: located.ayah,
      }),
    ],
  };
}

/**
 * The approved sources return their text with invisible characters attached — the
 * Quranpedia API prefixes an ayah with a byte-order mark, twice for the first
 * ayah. `normalizeWithMap` is position-preserving, so it keeps them, and an
 * equality check against a quotation then fails on a text that is in fact
 * identical. Stripping invisibles is done here rather than inside the shared
 * normalizer, because every other layer relies on that normalizer retaining one
 * key character per source character.
 */
const INVISIBLE = /[\uFEFF\u200B-\u200F\u2066-\u2069\u00A0]/g;

/** The comparison key for a span of approved text or a quotation of it. */
export function quoteKey(input: string): string {
  return normalizeWithMap(input.replace(INVISIBLE, ""), "arabic").key.replace(/\s+/g, "");
}

/**
 * Does this span match the approved text letter for letter?
 *
 * Comparison folds tashkeel and alef variants through the project's own key — the
 * point is to catch a changed or interpolated word, not a different but valid
 * vocalisation.
 */
export function quoteMatchesApproved(span: string, approved: string): boolean {
  const a = quoteKey(span);
  const b = quoteKey(approved);
  return a.length > 0 && a === b;
}
