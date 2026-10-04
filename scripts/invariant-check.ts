/**
 * Invariant: an honest meter never calls a text unfaithful to itself.
 *
 * Comparing a text against its own copy is the one case where the answer is
 * known before the run: nothing was changed, so nothing may be reported. Any
 * finding here is a defect in the check, not a property of the text — and it is
 * the cheapest way to catch a constraint that fires on the wrong form, because
 * a false alarm on a genuine hadith is exactly the kind of report that makes a
 * reviewer stop trusting the tool.
 *
 *   bun scripts/invariant-check.ts
 */

import { buildConstraintBank, runAudit } from "../src/lib/audit/index";
import type { AuditInput } from "../src/lib/audit/types";

const bank = buildConstraintBank();

const TEXTS: { label: string; text: string }[] = [
  {
    label: "hadith of the food portion (emphatic «وإنَّ»)",
    text: "إنَّ طعامَ الواحدِ يكفي الاثنَين ، و إنَّ طعامَ الاثنَين يكفي الثلاثةَ و الأربعةَ ، و إنَّ طعامَ الأربعةِ يكفي الخمسةَ و الستَّةَ .",
  },
  { label: "hadith of intentions", text: "إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى." },
  { label: "a ruling with a condition", text: "لا يجوز بيع الطعام قبل قبضه، ويجب على البائع بيانه للمشتري." },
  { label: "a verse carried in full", text: "قال تعالى: ﴿إِنَّ اللَّهَ مَعَ الصَّابِرِينَ﴾." },
];

let failures = 0;

for (const workType of ["translate", "summarize", "paraphrase"] as const) {
  for (const { label, text } of TEXTS) {
    const input: AuditInput = {
      sourceText: text,
      derivedText: text,
      workType,
      contentLevel: "B",
      targetLanguage: "en",
      bank,
      reviewerDecision: null,
    };
    const { result } = await runAudit(input);
    const drift = result.findings.filter((f) => f.cls === "shifted" || f.cls === "missing");
    const ok = drift.length === 0 && result.verdict !== "needs_revision";
    if (!ok) failures += 1;
    console.log(
      `  ${ok ? "ok  " : "FAIL"}  ${workType.padEnd(10)} ${label} — verdict=${result.verdict}` +
        (drift.length ? ` drift findings=${drift.length} (${[...new Set(drift.map((f) => f.kind))].join(",")})` : ""),
    );
    if (!ok) {
      for (const f of drift.slice(0, 3)) {
        console.log(`        ${f.cls} ${f.kind}: ${(f.evidence?.note ?? "").slice(0, 110)}`);
      }
    }
  }
}

console.log(
  failures === 0
    ? "\ninvariant holds: a text is never reported unfaithful to itself"
    : `\n${failures} case(s) reported a text unfaithful to itself`,
);
process.exit(failures === 0 ? 0 : 1);
