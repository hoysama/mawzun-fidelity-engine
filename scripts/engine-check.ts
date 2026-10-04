/**
 * Engine check — the proof that the audit engine behaves as the spec says.
 *
 * Run with:  bun scripts/engine-check.ts
 *
 * Every case asserts a behaviour, not a string. The cases that matter most are
 * the drift case (a prohibition rendered as a preference must be caught), the
 * hostile-model case (a model inventing a location must be rejected), and the
 * Qur'anic-quotation cases (a quote is compared against the approved mushaf,
 * and a replay needs no network).
 *
 * NO TEST TOUCHES THE NETWORK. Every run is handed an injected retriever — the
 * offline default, or a fake that answers a fixed quotation set — so the result
 * is deterministic and reproducible without the internet.
 */

import {
  runAudit,
  buildConstraintBank,
  verifyRecord,
  modelProvider,
  MAX_QURAN_LOOKUPS_PER_RUN,
} from "../src/lib/audit/index";
import type { Retriever } from "../src/lib/audit/index";
import { quoteKey } from "../src/lib/audit/rag";
import type { AuditInput, Finding } from "../src/lib/audit/types";

const bank = buildConstraintBank();

let failures = 0;
let checks = 0;

function assert(label: string, condition: boolean, detail = "") {
  checks++;
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function baseInput(over: Partial<AuditInput>): AuditInput {
  return {
    sourceText: "",
    derivedText: "",
    workType: "translate",
    contentLevel: "B",
    targetLanguage: "en",
    bank,
    reviewerDecision: null,
    ...over,
  };
}

// --- The offline retrieval fakes --------------------------------------------

const FIXED_NOW = "2026-10-03T00:00:00.000Z";

/** The default fake: no quotation is located, and it is never even asked when
 *  a text carries no ﴿…﴾ marker. */
const offlineRetriever: Retriever = {
  id: "test-offline",
  async lookupQuote() {
    return { status: "unlocated" };
  },
  async citeSpan() {
    return { citations: [], note: "test: لا استرجاع" };
  },
};

interface FauxAyah {
  /** The quotation as it appears in a text being checked. */
  readonly quote: string;
  /** The approved passage the connector would return for the location. */
  readonly approved: string;
  readonly surah: number;
  readonly ayah: number;
}

/**
 * A deterministic stand-in for the live connectors. It answers only the ayahs
 * it is given, returns "unlocated" for anything else, and counts how many
 * lookups it was asked to perform — which is how the run's ceiling is proven.
 */
function fakeRetriever(entries: readonly FauxAyah[]): { retriever: Retriever; calls: () => number } {
  let calls = 0;
  return {
    calls: () => calls,
    retriever: {
      id: "test-fake",
      async lookupQuote(quote: string) {
        calls++;
        const key = quoteKey(quote);
        const entry = entries.find((e) => quoteKey(e.quote) === key);
        if (!entry) return { status: "unlocated" as const };
        return {
          status: "located" as const,
          ayah: { surah: entry.surah, ayah: entry.ayah },
          approved: entry.approved,
          citation: {
            sourceId: "quranpedia" as const,
            label: "الموسوعة القرآنية",
            url: `https://api.quranpedia.net/v1/mushafs/1/${entry.surah}/${entry.ayah}`,
            retrievedAt: FIXED_NOW,
            hash: "",
            passage: entry.approved,
            kind: "quran" as const,
            ayah: { surah: entry.surah, ayah: entry.ayah },
          },
        };
      },
      async citeSpan() {
        calls++;
        return { citations: [] as const };
      },
    },
  };
}

/** The ornate brackets that mark a Qur'anic quotation in a text. */
const QO = "\uFD3F";
const QC = "\uFD3E";
const quoted = (s: string) => `${QO}${s}${QC}`;

const AYAH_112_1 = "قُلْ هُوَ اللَّهُ أَحَدٌ";

const case1 = baseInput({
  sourceText: "لا يجوز بيع الطعام قبل قبضه، ويجب على البائع بيانه للمشتري.",
  derivedText:
    "It is not recommended to sell food before taking possession, and the seller must clarify it to the buyer.",
});

const case2 = baseInput({
  sourceText: "قال النبي ﷺ: «إنما الأعمال بالنيات»، رواه البخاري (رقم 1).",
  derivedText: "The Prophet said: Actions are judged by their intentions.",
});

const case3 = baseInput({
  sourceText: "يستحب للمسلم إخلاص النية، ويجب عليه أداء الصلاة.",
  derivedText: "It is recommended for a Muslim to be sincere in intention, and he must perform the prayer.",
});

const case4 = baseInput({
  sourceText: "هل يجب علي إخراج زكاة هذا المال؟",
  derivedText: "Do I have to pay zakat on this money?",
  contentLevel: "D",
});

const run = async () => {
  console.log("\n=== 1. drift: prohibition rendered as a preference ===");
  {
    const { result, record } = await runAudit(case1, { now: FIXED_NOW, retriever: offlineRetriever });
    const shift = result.findings.find((f) => f.cls === "shifted" && f.kind === "ruling");
    console.log(`  verdict: ${result.verdict}`);
    console.log(`  reason : ${result.reason.slice(0, 160)}`);
    assert("verdict is needs_revision", result.verdict === "needs_revision", result.verdict);
    assert("a shifted ruling finding exists", Boolean(shift));
    assert("the shifted span is the bad rendering", shift?.span.toLowerCase().includes("not recommended") === true, shift?.span);
    assert("the finding carries evidence of both forces", Boolean(shift?.evidence.note.includes("ملزم")));
    assert("the finding has a non-zero location in the derived text", (shift?.end ?? 0) > (shift?.start ?? 0));
    assert("the L2 finding carries its package citation", shift?.citations?.[0]?.sourceId === "package");
    assert("the record was sealed", record.digest.length === 64, record.digest);
  }

  console.log("\n=== 2. dropped isnad and dropped number ===");
  {
    const { result } = await runAudit(case2, { now: FIXED_NOW, retriever: offlineRetriever });
    console.log(`  verdict: ${result.verdict}`);
    assert("verdict is needs_revision", result.verdict === "needs_revision", result.verdict);
    assert(
      "a missing isnad finding exists",
      result.findings.some((f) => f.kind === "isnad" && f.cls === "missing"),
    );
    assert(
      "a missing number finding exists",
      result.findings.some((f) => f.kind === "number" && f.cls === "missing"),
    );
    assert("layer 1 is the layer that caught both", result.layerSummary.L1.missing >= 2, JSON.stringify(result.layerSummary));
  }

  console.log("\n=== 3. faithful transfer ===");
  {
    const { result } = await runAudit(case3, { now: FIXED_NOW, retriever: offlineRetriever });
    console.log(`  verdict: ${result.verdict}`);
    assert("verdict is faithful", result.verdict === "faithful", result.verdict);
    assert(
      "no shifted or missing findings",
      result.findings.every((f) => f.cls === "preserved"),
      JSON.stringify(result.findings.map((f) => f.cls)),
    );
  }

  console.log("\n=== 4. level د stops without judging ===");
  {
    const { result } = await runAudit(case4, { now: FIXED_NOW, retriever: offlineRetriever });
    console.log(`  verdict: ${result.verdict}`);
    assert("verdict is refer", result.verdict === "refer", result.verdict);
    assert("no findings were produced", result.findings.length === 0);
  }

  console.log("\n=== 5. hostile model output is rejected ===");
  {
    const fabricated = JSON.stringify({
      findings: [
        {
          question: "ruling_force",
          cls: "shifted",
          source_quote: "لا يجوز",
          derived_quote: "this phrase is not in the derived text at all",
          note: "invented",
        },
        {
          question: "condition",
          cls: "shifted",
          source_quote: "كلام لا وجود له في الأصل",
          derived_quote: "It is not recommended",
          note: "invented source quote",
        },
      ],
    });

    const provider = modelProvider(async () => ({ raw: fabricated, model: "test-model", promptHash: "abc" }));
    const { result, rejected } = await runAudit(case1, {
      semantic: provider,
      now: FIXED_NOW,
      retriever: offlineRetriever,
    });

    assert("both fabricated findings were rejected", rejected.length === 2, JSON.stringify(rejected));
    assert("no layer 3 finding survived", result.findings.every((f) => f.layer !== "L3"));
  }

  console.log("\n=== 6. a truthful model finding is accepted and locatable ===");
  {
    const truthful = JSON.stringify({
      findings: [
        {
          question: "ruling_force",
          cls: "shifted",
          source_quote: "لا يجوز",
          derived_quote: "not recommended",
          note: "المنع في الأصل ظهر في المشتق بلفظ أولوية أقل",
        },
      ],
    });
    const provider = modelProvider(async () => ({ raw: truthful, model: "test-model", promptHash: "abc" }));
    const { result, record } = await runAudit(case1, {
      semantic: provider,
      now: FIXED_NOW,
      retriever: offlineRetriever,
    });
    const l3 = result.findings.find((f) => f.layer === "L3");

    assert("the finding was accepted", Boolean(l3));
    assert("it points at a real span", (l3?.end ?? 0) > (l3?.start ?? 0));
    assert("the record names the model", record.model.id === "test-model" && record.model.promptHash === "abc");
  }

  console.log("\n=== 7. record integrity and replay ===");
  {
    const { record } = await runAudit(case1, { now: FIXED_NOW, retriever: offlineRetriever });

    const good = await verifyRecord(record);
    assert("an untouched record verifies", good.ok, JSON.stringify(good.notes));
    assert("the sealed record aggregates the run's citations", record.citations.length > 0, String(record.citations.length));

    const tampered = {
      ...record,
      findings: record.findings.map((f, i) => (i === 0 ? { ...f, note: "edited after the fact" } : f)),
    };
    const bad = await verifyRecord(tampered);
    assert("a tampered record fails", !bad.ok);
    assert("it fails on the digest", !bad.digestMatches);

    const trimmed = { ...record, findings: record.findings.filter((f) => f.cls === "preserved") };
    const replay = await verifyRecord(trimmed);
    assert("a record with the drift removed fails the verdict replay", !replay.verdictReproduces);

    const again = await runAudit(case1, { now: FIXED_NOW, retriever: offlineRetriever });
    assert("re-running the same input yields the same digest", again.record.digest === record.digest);
  }

  console.log("\n=== 8. normalizer keys ===");
  {
    const { arabicKey } = await import("../src/lib/audit/normalize");
    assert("alef variants collapse", arabicKey("أحمد") === arabicKey("احمد"));
    assert("ta-marbuta maps to ha", arabicKey("صلاة") === arabicKey("صلاه"));
    assert("yeh-with-hamza maps to yeh", arabicKey("حائل") === arabicKey("حايل"), arabicKey("حائل"));
    assert("tashkeel is dropped", arabicKey("النِّيَّة") === arabicKey("النيه"), arabicKey("النِّيَّة"));
  }

  console.log("\n=== 9. a correct Qur'anic quotation is preserved, with its citation ===");
  {
    const input = baseInput({
      sourceText: `قال الله تعالى: ${quoted(AYAH_112_1)}.`,
      derivedText: `Allah says: ${quoted(AYAH_112_1)}.`,
    });
    const fake = fakeRetriever([{ quote: AYAH_112_1, approved: AYAH_112_1, surah: 112, ayah: 1 }]);
    const { result } = await runAudit(input, { retriever: fake.retriever, now: FIXED_NOW });

    const preserved = result.findings.find((f) => f.kind === "quote" && f.cls === "preserved");
    console.log(`  verdict: ${result.verdict}`);
    assert("a preserved quotation finding exists", Boolean(preserved), JSON.stringify(result.findings.map((f) => f.cls)));
    assert(
      "it carries the ayah citation (112:1)",
      preserved?.citations?.[0]?.ayah?.surah === 112 && preserved?.citations?.[0]?.ayah?.ayah === 1,
      JSON.stringify(preserved?.citations),
    );
    assert("the evidence note names the surah:ayah", preserved?.evidence.note.includes("112:1") === true, preserved?.evidence.note);
    assert("the verdict is faithful", result.verdict === "faithful", result.verdict);
  }

  console.log("\n=== 10. one changed word is a shift, named side by side ===");
  let shiftedRecord: Awaited<ReturnType<typeof runAudit>>["record"] | null = null;
  {
    const input = baseInput({
      sourceText: `قال الله تعالى: ${quoted(AYAH_112_1)}.`,
      derivedText: `Allah says: ${quoted("قُلْ هُوَ اللَّهُ الصَّمَدُ")}.`,
    });
    const fake = fakeRetriever([
      { quote: "قُلْ هُوَ اللَّهُ الصَّمَدُ", approved: AYAH_112_1, surah: 112, ayah: 1 },
      { quote: AYAH_112_1, approved: AYAH_112_1, surah: 112, ayah: 1 },
    ]);
    const { result, record } = await runAudit(input, { retriever: fake.retriever, now: FIXED_NOW });
    shiftedRecord = record;

    const shifted = result.findings.find((f) => f.kind === "quote" && f.cls === "shifted");
    console.log(`  verdict: ${result.verdict}`);
    assert("a shifted quotation finding exists", Boolean(shifted), JSON.stringify(result.findings.map((f) => f.cls)));
    assert("the evidence puts the approved wording beside the quoted one", Boolean(shifted?.evidence.source && shifted?.evidence.derived && shifted.evidence.source !== shifted.evidence.derived));
    assert("the approved wording is the ayah", quotedContains(shifted?.evidence.source ?? "", "أَحَد") , shifted?.evidence.source);
    assert("the quoted wording carries the changed word", quotedContains(shifted?.evidence.derived ?? "", "الصَّمَد"), shifted?.evidence.derived);
    assert("the citation fixes the ayah (112:1)", shifted?.citations?.[0]?.ayah?.ayah === 1);
    assert("the dropped-verse check did not double-report", result.findings.filter((f) => f.kind === "quote").length === 1);
    assert("the verdict is needs_revision", result.verdict === "needs_revision", result.verdict);
  }

  console.log("\n=== 11. a quotation that cannot be located is unlocatable, not wrong ===");
  {
    const input = baseInput({
      sourceText: "نصٌّ خالٍ من الاقتباس.",
      derivedText: `ثم قال ${quoted("هَذَا لَيْسَ مِنْ نَصِّ الْقُرْآنِ")} وبعده كلام.`,
    });
    const fake = fakeRetriever([]);
    const { result } = await runAudit(input, { retriever: fake.retriever, now: FIXED_NOW });

    const note = result.coverage.find((c) => c.kind === "quote");
    console.log(`  note   : ${note?.reason.slice(0, 160)}`);
    assert("no quotation finding was fabricated", result.findings.filter((f) => f.kind === "quote").length === 0);
    assert("a coverage note reports the quotation as unlocatable", Boolean(note));
    assert("the note ties the failure to a location, not to correctness", note?.reason.includes("لم يُربط") === true, note?.reason);
    assert("the note says explicitly it is not a judgement that it is wrong", note?.reason.includes("ليس حكمًا بأنه خطأ") === true, note?.reason);
    assert("the verdict is needs_revision (an unchecked quotation blocks certification)", result.verdict === "needs_revision", result.verdict);
  }

  console.log("\n=== 12. a source quotation dropped from the derived text is missing ===");
  {
    const input = baseInput({
      sourceText: `قال الله تعالى: ${quoted(AYAH_112_1)}.`,
      derivedText: "Allah is one.",
    });
    const fake = fakeRetriever([{ quote: AYAH_112_1, approved: AYAH_112_1, surah: 112, ayah: 1 }]);
    const { result } = await runAudit(input, { retriever: fake.retriever, now: FIXED_NOW });

    const missing = result.findings.find((f) => f.kind === "quote" && f.cls === "missing");
    console.log(`  verdict: ${result.verdict}`);
    assert("a missing quotation finding exists", Boolean(missing), JSON.stringify(result.findings.map((f) => f.cls)));
    assert("the missing finding carries the source wording", missing?.evidence.source === AYAH_112_1, missing?.evidence.source);
    assert("the missing finding has no derived span", missing?.span === "" && missing.start === missing.end);
    assert("the verdict is needs_revision", result.verdict === "needs_revision", result.verdict);
  }

  console.log("\n=== 13. replay from the sealed record, with no retriever ===");
  {
    assert("the shifted run produced a sealed record", Boolean(shiftedRecord));
    const replay = await verifyRecord(shiftedRecord!);
    assert("the sealed record verifies", replay.ok, JSON.stringify(replay.notes));
    assert("its digest matches", replay.digestMatches);
    assert("its verdict re-derives from the recorded findings", replay.verdictReproduces);
    assert("its quotations replay against the SEALED passage, offline", replay.quotesReplay);

    const tamperedCitations = {
      ...shiftedRecord!,
      findings: shiftedRecord!.findings.map((f) =>
        f.citations && f.citations.length > 0
          ? { ...f, citations: f.citations.map((c) => ({ ...c, passage: `${c.passage} زائد` })) }
          : f,
      ) as readonly Finding[],
    };
    const bad = await verifyRecord(tamperedCitations);
    assert("tampering a sealed citation breaks the digest", !bad.digestMatches);
  }

  console.log("\n=== 14. retrieval is bounded per run, and the rest is declared ===");
  {
    const distinct = Array.from({ length: 20 }, (_, i) => `مَقْطَعٌ رَقْمُهُ ${i}`);
    const fake = fakeRetriever(distinct.map((q, i) => ({ quote: q, approved: q, surah: 1, ayah: i + 1 })));
    const input = baseInput({
      sourceText: distinct.map(quoted).join(" "),
      derivedText: distinct.map(quoted).join(" "),
    });
    const { result } = await runAudit(input, { retriever: fake.retriever, now: FIXED_NOW });

    console.log(`  lookups: ${fake.calls()} of a ${MAX_QURAN_LOOKUPS_PER_RUN} ceiling`);
    assert(
      `retrieval stops at the ${MAX_QURAN_LOOKUPS_PER_RUN}-lookup ceiling`,
      fake.calls() === MAX_QURAN_LOOKUPS_PER_RUN,
      String(fake.calls()),
    );
    assert(
      "the quotations left unchecked are declared, not dropped",
      result.coverage.some((c) => c.kind === "quote" && c.reason.includes("سقف")),
    );
  }

  console.log("\n=== 15. with retrieval disabled, layer 1 declares it could not run ===");
  {
    const input = baseInput({
      sourceText: `الإسلام دين، قال الله تعالى: ${quoted(AYAH_112_1)}.`,
      derivedText: `Islam is a religion. Allah says: ${quoted(AYAH_112_1)}.`,
    });
    const { result } = await runAudit(input, { retriever: null, now: FIXED_NOW });

    const note = result.coverage.find((c) => c.kind === "quote");
    console.log(`  note   : ${note?.reason.slice(0, 160)}`);
    assert("a coverage note says the check did not run", note?.reason.includes("لم تُشغَّل") === true, note?.reason);
    assert("no quotation finding is fabricated without retrieval", result.findings.filter((f) => f.kind === "quote").length === 0);
    assert("the unchecked quotation blocks certification", result.verdict === "needs_revision", result.verdict);
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures > 0) {
    console.error(`${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("engine check passed");
};

/** Does `haystack` carry `needle` once tashkeel and alef variants are folded? */
function quotedContains(haystack: string, needle: string): boolean {
  return quoteKey(haystack).includes(quoteKey(needle));
}

run().catch((error) => {
  console.error("engine check crashed:", error);
  process.exit(1);
});
