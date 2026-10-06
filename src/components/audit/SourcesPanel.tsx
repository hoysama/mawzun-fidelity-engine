"use client";

/**
 * Where the audit's evidence comes from, and what this deployment could reach.
 *
 * This is the retrieval layer's own status table, read straight from
 * `SOURCE_STATUSES`: every approved source, its Arabic label, its address, the
 * package's usage rule for it, and the state measured from this environment.
 * The three sources that answer automated clients with 403 are declared
 * unreachable with the reason and the measured status rather than being quietly
 * absent — a reviewer must be able to see that this run's evidence is partial
 * for that reason, and that no substitute was invented for a source that could
 * not be reached.
 *
 * The panel does not accuse the unavailable sources of failing to answer a
 * question well: it reports only that they could not be reached from here, and
 * leaves what they would have said unclaimed.
 */

import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";
import { SOURCE_STATUSES } from "@/lib/audit/rag";
import type { SourceKind } from "@/lib/audit/rag-types";
import { CodeChip, StatusChip } from "./parts";

/** The measured state of a source, in the reader's words rather than a code. */
const STATE: Record<SourceKind, { tone: "verified" | "neutral" | "escalate"; label: string }> = {
  "live-api": { tone: "verified", label: "متاح: واجهة برمجية حيّة" },
  "live-fetch": { tone: "verified", label: "متاح: جلب حيّ" },
  "local-package": { tone: "neutral", label: "محفوظ محليًّا في الحزمة" },
  unreachable: { tone: "escalate", label: "غير قابل للوصول" },
};

/**
 * Wrap bare Latin identifier runs in « » so Arabic prose carries them the way
 * the interface's copy rule requires (URLs, file paths, status terms). Runs
 * already inside a « » quotation are left alone, and runs without a Latin
 * letter or a path marker — a bare status number, for instance — are left as
 * they are, because they are values rather than identifiers.
 */
const LATIN_RUN = /[A-Za-z*/][A-Za-z0-9._\-:/?#&=+%@*]*/g;

function bracketLatin(text: string): string {
  return text
    .split(/(«[^»]*»)/g)
    .map((segment, index) =>
      index % 2 === 1 ? segment : segment.replace(LATIN_RUN, (run) => `«${run}»`),
    )
    .join("");
}

/** A Latin address is an identifier and is bracketed; an Arabic one is not. */
function addressText(address: string): string {
  return /[A-Za-z]/.test(address) ? `«${address}»` : address;
}

export function SourcesPanel({ citationCount }: { citationCount: number }) {
  const unreachable = SOURCE_STATUSES.filter((source) => source.kind === "unreachable");

  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-low p-space-md">
      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <span className={cx(t.label, "font-semibold text-on-surface")}>المصادر المعتمدة وحالتها</span>
        <CodeChip>{`${SOURCE_STATUSES.length} مصادر · ${unreachable.length} غير متاحة`}</CodeChip>
      </div>

      <p className={cx(t.bodySm, "mt-space-xs text-on-surface-variant")}>
        {`حالة كل مصدر معتمد كما قيست من هذا المنشأ. تعذّر الوصول إلى ${unreachable.length} من ${SOURCE_STATUSES.length}، ولم يُختلق لها بديل: ما توقف عليها يظهر فجوةً معلنة في «ما لم يُفحص في هذا التشغيل»، لا مصدرًا بديلًا.`}
      </p>

      <p className={cx(t.bodySm, "mt-space-xs text-on-surface-variant")}>
        {citationCount > 0
          ? `حمل هذا التشغيل ${citationCount} استشهادًا من مصادر معتمدة، وهي معروضة تحت كل واقعة.`
          : "لم يُسجَّل في هذا التشغيل أي استشهاد من مصدر معتمد؛ والامتناع ليس موافقة، وما تعذّر فحصه مذكور في «ما لم يُفحص في هذا التشغيل»."}
      </p>

      <ul className="mt-space-sm flex flex-col gap-space-xs">
        {SOURCE_STATUSES.map((source) => {
          const state = STATE[source.kind];
          return (
            <li
              key={source.id}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-space-xs">
                <div className="flex flex-wrap items-center gap-space-xs">
                  <span className={cx(t.label, "font-semibold text-on-surface")}>{source.label}</span>
                  <span className={cx(t.code, "text-on-surface-variant")}>{addressText(source.address)}</span>
                  {source.httpStatus !== null && (
                    <span dir="ltr" className={cx(t.code, "text-on-surface-variant")}>
                      {`HTTP ${source.httpStatus}`}
                    </span>
                  )}
                </div>
                <StatusChip tone={state.tone}>{state.label}</StatusChip>
              </div>

              <p className={cx(t.bodySm, "mt-space-xs text-on-surface-variant")}>
                <span className="font-semibold">قاعدة الحزمة: </span>
                {`«${bracketLatin(source.rule)}»`}
              </p>
              <p className={cx(t.bodySm, "mt-space-xs text-on-surface")}>{bracketLatin(source.detail)}</p>
            </li>
          );
        })}
      </ul>

      <div className="mt-space-sm rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm">
        <p className={cx(t.bodySm, "text-on-surface-variant")}>
          النص القرآني المعتمد يُقرأ حيًّا من{" "}
          <a
            href="https://quranpedia.net"
            target="_blank"
            rel="noreferrer"
            dir="ltr"
            className="text-moss-700 underline underline-offset-2"
          >
            «quranpedia.net»
          </a>
          . هذا إشهار بمصدر النص على سبيل المجاملة، لا إقرار بالتزام تعاقدي: سياسة المصدر توجب النسبة عند إعادة النشر،
          وهذا التشغيل يقرأ ولا يعيد النشر.
        </p>
      </div>
    </div>
  );
}
