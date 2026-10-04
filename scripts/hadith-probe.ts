/**
 * Tests for the hadith family: a transmission carried by a hadith rather than a
 * verse.
 *
 * What these cover that the Quranic tests do not:
 *  - the ruling-force and isnad constraints on hadith wording,
 *  - the exclusivity particle «إنما», whose loss widens a confined ruling,
 *  - what happens when a hadith is presented as if it were a verse: the engine
 *    must refuse to tie it to an ayah rather than invent one,
 *  - the work-type scope: a summary is not called drifting for a dropped particle.
 *
 *   bun scripts/hadith-probe.ts
 */

import { buildConstraintBank, runAudit } from "../src/lib/audit/index";
import type { AuditInput } from "../src/lib/audit/types";

const bank = buildConstraintBank();
const HADITH = "إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى.";

function input(sourceText: string, derivedText: string): AuditInput {
  return {
    sourceText,
    derivedText,
    workType: "translate",
    contentLevel: "A",
    targetLanguage: "en",
    bank,
    reviewerDecision: null,
  };
}

let failures = 0;
function assert(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures += 1;
}

async function audit(source: string, derived: string) {
  return (await runAudit(input(source, derived))).result;
}

console.log("1) the hadith carried faithfully");
{
  const r = await audit(
    HADITH,
    "Actions are only by intentions, and every person will have only what he intended.",
  );
  console.log("   verdict:", r.verdict);
  assert("a faithful rendering is not flagged", r.verdict === "faithful", r.verdict);
}

console.log("2) the hadith turned from a restriction into a comparison");
{
  const r = await audit(HADITH, "Intention is more important than the action itself.");
  const restriction = r.findings.filter((f) => f.kind === "restriction");
  console.log("   verdict:", r.verdict, "| restriction findings:", restriction.length);
  assert("the lost exclusivity is reported", restriction.length > 0);
  assert("the verdict is not faithful", r.verdict !== "faithful");
  assert("the reason names the restriction", r.reason.includes("الحصر"), r.reason.slice(0, 60));
}

console.log("3) a hadith presented as a verse of the Quran");
{
  const r = await audit(
    "قال تعالى: ﴿إنما الأعمال بالنيات﴾",
    "Allah says: ﴿إنما الأعمال بالنيات﴾",
  );
  const quoteNotes = r.coverage.filter((c) => c.kind === "quote");
  const attributed = r.findings.filter(
    (f) => f.kind === "quote" && f.citations?.some((c) => c.ayah !== undefined),
  );
  console.log("   verdict:", r.verdict, "| quote coverage notes:", quoteNotes.length);
  assert("it is not attributed to an ayah", attributed.length === 0);
  assert(
    "a note says it could not be tied to the mushaf",
    quoteNotes.length > 0,
    quoteNotes[0]?.reason.slice(0, 70),
  );
  assert("the verdict is not faithful while it is unverified", r.verdict !== "faithful");
}

console.log("4) work-type scope: a summary is not flagged for a dropped particle");
{
  const { result } = await runAudit({
    ...input(
      "قال النبي ﷺ: «إنما الأعمال بالنيات»، رواه البخاري برقم 1.",
      "The Prophet said: Deeds are judged by intentions. Reported by al-Bukhari, Hadith 1.",
    ),
    workType: "summarize",
  });
  const drift = result.findings.filter((f) => f.kind === "restriction" && f.cls !== "preserved");
  const declared = result.coverage.some((c) => c.kind === "restriction");
  console.log("   verdict:", result.verdict, "| restriction drift findings:", drift.length);
  assert("a clean summary is not called drifting", drift.length === 0, result.verdict);
  assert("the scope is declared rather than silent", declared);
}

console.log(failures === 0 ? "\nhadith tests passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
