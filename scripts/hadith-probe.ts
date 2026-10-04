/**
 * A real run on the hadith «إنما الأعمال بالنيات».
 *
 * Three things are worth watching here that a Quranic verse would not show:
 *  - the ruling-force constraint (the hadith restricts validity to the intention),
 *  - what the engine does when a hadith is presented as if it were a verse,
 *  - whether a drifted rendering of it is caught at all.
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

async function run(label: string, source: string, derived: string) {
  const { result } = await runAudit(input(source, derived));
  console.log(`\n── ${label}`);
  console.log(`   الحكم: ${result.verdict}`);
  console.log(`   السبب: ${result.reason.slice(0, 180)}`);
  for (const f of result.findings) {
    if (f.cls === "preserved") continue;
    const cite = f.citations?.[0];
    console.log(
      `   - ${f.cls.padEnd(9)} ${f.kind.padEnd(9)} «${(f.span ?? "").slice(0, 46)}»` +
        (cite ? ` [${cite.sourceId}]` : "") +
        (f.evidence?.note ? ` :: ${f.evidence.note.slice(0, 90)}` : ""),
    );
  }
  for (const c of result.coverage) {
    console.log(`   · تغطية [${c.layer}/${c.kind}]: ${c.reason.slice(0, 110)}`);
  }
  return result;
}

console.log("المدخل: حديث «إنما الأعمال بالنيات» — مستوى (أ)، ترجمة إلى الإنجليزية");

await run(
  "١) ترجمة سليمة",
  HADITH,
  "Actions are only by intentions, and every person will have only what he intended.",
);

await run(
  "٢) ترجمة حوّلت الحكم إلى مقارنة",
  HADITH,
  "Intention is more important than the action itself.",
);

await run(
  "٣) الحديث مقدَّم على أنه آية من القرآن",
  `قال تعالى: ﴿إنما الأعمال بالنيات﴾`,
  `Allah says: ﴿إنما الأعمال بالنيات﴾`,
);
