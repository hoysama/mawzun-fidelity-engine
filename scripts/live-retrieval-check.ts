/**
 * End-to-end check of the LIVE retriever through the engine.
 *
 * `engine-check.ts` deliberately runs offline with a fake retriever, so nothing in
 * the test suite proves the real connectors work when the engine calls them. This
 * does: it runs the real `runAudit` with the default (live) retriever against a
 * text carrying a Quranic quotation, and against a tampered one.
 *
 *   bun scripts/live-retrieval-check.ts
 */

import { buildConstraintBank, runAudit, verifyRecord } from "../src/lib/audit/index";
import type { AuditInput } from "../src/lib/audit/types";

const bank = buildConstraintBank();

function input(source: string, derived: string): AuditInput {
  return {
    sourceText: source,
    derivedText: derived,
    workType: "translate",
    contentLevel: "B",
    targetLanguage: "en",
    bank,
    reviewerDecision: null,
  };
}

const VERSE = "﴿إِنَّ اللَّهَ مَعَ الصَّابِرِينَ﴾";
const TAMPERED = "﴿إِنَّ اللَّهَ مَعَ الصَّابِرُونَ﴾";

let failures = 0;
function assert(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures += 1;
}

console.log("1) a carried verse, quoted exactly");
{
  const src = `قال تعالى: ${VERSE}، وهذا أصل عظيم في الصبر.`;
  const drv = `Allah says: ${VERSE} This is a great principle of patience.`;
  const { result, record } = await runAudit(input(src, drv));
  const quotes = result.findings.filter((f) => f.kind === "quote");
  const preserved = quotes.find((f) => f.cls === "preserved");
  console.log("   verdict:", result.verdict, "| quote findings:", quotes.map((f) => f.cls).join(","));
  assert("a preserved quotation finding exists", Boolean(preserved));
  const cite = preserved?.citations?.[0];
  assert("it carries a quranpedia citation", cite?.sourceId === "quranpedia", cite ? `${cite.ayah?.surah}:${cite.ayah?.ayah}` : "no citation");
  assert("the citation has a real approved passage", Boolean(cite?.passage && cite.passage.length > 5), cite?.passage?.slice(0, 40));
  assert("the citation records where and when it was read", Boolean(cite?.url && cite?.retrievedAt), cite?.url);
  assert("the record seals the citations", JSON.stringify(record).includes("quranpedia"));
  const verified = await verifyRecord(record);
  assert("the sealed record verifies", verified.ok, verified.notes.join(" | ").slice(0, 120));
  console.log("   digest:", record.digest.slice(0, 32));
}

console.log("2) the same verse, one letter changed");
{
  const src = `قال تعالى: ${VERSE}.`;
  const drv = `Allah says: ${TAMPERED}`;
  const { result } = await runAudit(input(src, drv));
  const quotes = result.findings.filter((f) => f.kind === "quote");
  console.log("   verdict:", result.verdict, "| quote findings:", quotes.map((f) => `${f.cls}`).join(","));
  const shifted = quotes.find((f) => f.cls === "shifted");
  assert("the changed verse is reported as shifted", Boolean(shifted));
  assert("the shift is anchored to an ayah", Boolean(shifted?.citations?.[0]?.ayah));
  assert("the verdict is not faithful", result.verdict !== "faithful");
}

console.log("3) a verse dropped from the derived text");
{
  const src = `قال تعالى: ${VERSE}، فالصبر مطلوب.`;
  const drv = "Patience is required.";
  const { result } = await runAudit(input(src, drv));
  const quotes = result.findings.filter((f) => f.kind === "quote");
  console.log("   verdict:", result.verdict, "| quote findings:", quotes.map((f) => f.cls).join(","));
  assert("the dropped verse is reported", quotes.some((f) => f.cls === "missing"));
}

console.log("4) a quotation that is not in the mushaf");
{
  const src = "نصٌّ فيه ﴿هذا ليس بآية من القرآن الكريم﴾ على سبيل الاختبار.";
  const drv = "A text containing ﴿هذا ليس بآية من القرآن الكريم﴾ for the test.";
  const { result } = await runAudit(input(src, drv));
  const quotes = result.findings.filter((f) => f.kind === "quote");
  const notes = result.coverage.filter((c) => c.kind === "quote");
  console.log("   quote findings:", quotes.length, "| quote coverage notes:", notes.length);
  assert("nothing is fabricated as a located verse", quotes.every((f) => f.cls === "missing" || f.cls === "shifted" || f.cls === "preserved") && !quotes.some((f) => f.citations?.[0]?.ayah !== undefined && f.cls === "preserved"));
  assert("a note explains what happened", notes.length > 0, notes[0]?.reason.slice(0, 90));
}

console.log("5) how many outbound requests did that cost?");
{
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    calls += 1;
    return original(...args);
  }) as typeof fetch;
  const src = `قال تعالى: ${VERSE}`;
  const drv = `Allah says: ${VERSE}`;
  await runAudit(input(src, drv));
  globalThis.fetch = original;
  console.log("   requests:", calls);
  assert("within the stated per-run bound of 33", calls <= 33, `${calls} requests`);
}

console.log(failures === 0 ? "\nlive retrieval check passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
