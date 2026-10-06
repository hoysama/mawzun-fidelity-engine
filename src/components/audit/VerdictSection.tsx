"use client";

/**
 * Step 4 — الحكم التقريري.
 *
 * One verdict, three states, and the three mandatory attachments on every
 * verdict: the reason, the location and the evidence. The suggested correction
 * is not invented by the interface — it is the approved rendering the
 * constraint bank declares for the constraint that drifted, or an explicit
 * statement that no automatic suggestion exists.
 */

import { useMemo } from "react";
import { Icon } from "@/components/ui/Icon";
import { useAudit } from "@/context/AuditContext";
import { buildConstraintBank } from "@/lib/audit";
import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";
import type { AuditResult } from "@/lib/audit/types";
import type { Citation } from "@/lib/audit/rag-types";
import { CitationList, CodeChip, FINDING_LABEL, FINDING_TONE, InsetPanel, StatusChip, WorkflowCard } from "./parts";

const VERDICTS: { id: AuditResult["verdict"]; label: string }[] = [
  { id: "faithful", label: "مطابق" },
  { id: "needs_revision", label: "يحتاج تعديل" },
  { id: "refer", label: "وقف وتحويل" },
];

// Package citations from the shipped document carry no hash (the file is local,
// not fetched), so the passage is part of the identity: two different
// constraints must never collapse into one citation row.
const citationKey = (citation: Citation): string =>
  `${citation.sourceId}|${citation.url}|${citation.kind}|${citation.passage}`;

/** Keep each passage once, so one source is never printed twice on a verdict. */
function dedupeCitations(citations: readonly Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = citationKey(citation);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function VerdictSection() {
  const audit = useAudit();
  const result = audit.result;
  const bank = useMemo(() => buildConstraintBank(), []);

  const decisive = result?.findings.filter((f) => f.cls !== "preserved") ?? [];
  const first = decisive[0];

  /**
   * The citations the verdict rests on. The evidence pane prints the first
   * decisive finding's citations next to the evidence it quotes; the reason
   * pane prints the rest, so the same passage is never printed twice on one
   * verdict. Both are read from the findings, never composed here.
   */
  const firstCitations = first?.citations ?? [];
  const firstCitationKeys = new Set(firstCitations.map(citationKey));
  const verdictCitations = dedupeCitations(
    decisive.flatMap((finding) => finding.citations ?? []),
  ).filter((citation) => !firstCitationKeys.has(citationKey(citation)));

  /**
   * The suggested replacement, taken from the bank rather than composed here:
   * if the drifted item is a constraint we hold approved renderings for, the
   * first approved rendering is the suggestion. Otherwise we say so.
   */
  const suggestion = (() => {
    if (!first) return null;
    if (!first.constraintId) return null;
    const constraint = bank.constraints.find((c) => c.id === first.constraintId);
    if (!constraint) return null;
    const approved = constraint.approved[audit.targetLanguage] ?? [];
    return approved.length > 0 ? approved : null;
  })();

  return (
    <WorkflowCard
      id="step-4"
      number={4}
      title="الحكم"
      subtitle="قرار واحد بثلاث حالات، ومعه السبب والموضع والدليل"
      aside={
        result ? (
          <CodeChip>الوقت: {audit.record?.createdAt ?? "—"}</CodeChip>
        ) : (
          <StatusChip tone="neutral">بانتظار الفحص</StatusChip>
        )
      }
    >
      <div className="grid grid-cols-1 gap-space-sm md:grid-cols-3">
        {VERDICTS.map((verdict) => {
          const isActive = result?.verdict === verdict.id;
          return (
            <div
              key={verdict.id}
              className={cx(
                "flex items-center justify-between rounded-xl p-space-md transition-colors",
                !result
                  ? "bg-surface-container text-on-surface-variant opacity-60"
                  : isActive
                    ? verdict.id === "faithful"
                      ? "bg-moss-100 text-moss-800 shadow-sm"
                      : verdict.id === "needs_revision"
                        ? "bg-secondary-fixed text-on-secondary-fixed-variant shadow-sm"
                        : "bg-error-container text-on-error-container shadow-sm"
                    : "bg-surface-container text-on-surface-variant opacity-60",
              )}
            >
              <span className={cx(t.h4, "flex items-center gap-space-xs")}>{verdict.label}</span>
              {isActive ? (
                <StatusChip tone="neutral" className="bg-transparent">
                  الحالة النشطة
                </StatusChip>
              ) : (
                <Icon name="radio_button_unchecked" className="text-[18px] opacity-60" />
              )}
            </div>
          );
        })}
      </div>

      {!result ? (
        <InsetPanel>
          <p className={cx(t.body, "text-on-surface-variant")}>
            نفّذ الفحص من الخطوة الأولى ليصدر الحكم.
          </p>
        </InsetPanel>
      ) : (
        <>
          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-space-lg">
            <div className="grid grid-cols-1 gap-space-md md:grid-cols-3">
              <div className="flex flex-col gap-space-xs rounded-lg border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
                <span className={cx(t.labelSm, "font-semibold text-on-surface-variant")}>الموضع</span>
                <span className={cx(t.h4, "text-on-surface")}>
                  {decisive.length > 0
                    ? decisive.filter((f) => f.end > f.start).length > 0
                      ? `${decisive.filter((f) => f.end > f.start).length} موضع محدد`
                      : "لا موضع محدد"
                    : "لا موضع يستدعي التعديل"}
                </span>
                <span className={cx(t.code, "text-on-surface-variant")}>
                  {decisive
                    .filter((f) => f.end > f.start)
                    .map((f) => `${f.start}:${f.end}`)
                    .join(" · ") || "—"}
                </span>
              </div>

              <div className="flex flex-col gap-space-xs rounded-lg border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm md:col-span-2">
                <span className={cx(t.labelSm, "font-semibold text-on-surface-variant")}>السبب</span>
                <p className={cx(t.body, "text-on-surface")}>{result.reason}</p>
                {verdictCitations.length > 0 && (
                  <CitationList citations={verdictCitations} title="حيث يمكن التحقق من الحكم" />
                )}
              </div>
            </div>

            <div className="mt-space-md flex flex-col gap-space-md">
              <div className="flex flex-col gap-space-xs rounded-lg border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
                <span className={cx(t.labelSm, "font-semibold text-on-surface-variant")}>الدليل</span>
                {first ? (
                  <div className="flex flex-col gap-space-xs">
                    <blockquote className={cx(t.body, "rounded-lg bg-surface-container-low p-space-sm italic text-on-surface")}>
                      <span className={cx(t.code, "block text-outline")}>من الأصل</span>
                      {first.evidence.source || "—"}
                    </blockquote>
                    <blockquote className={cx(t.body, "rounded-lg bg-surface-container-low p-space-sm italic text-on-surface")}>
                      <span className={cx(t.code, "block text-outline")}>من المشتق</span>
                      {first.evidence.derived || "—"}
                    </blockquote>
                    <p className={cx(t.bodySm, "text-on-surface-variant")}>{first.evidence.note}</p>
                    {firstCitations.length > 0 && (
                      <CitationList citations={firstCitations} title="حيث يمكن التحقق من هذه الواقعة" />
                    )}
                  </div>
                ) : (
                  <p className={cx(t.bodySm, "text-on-surface-variant")}>
                    لا واقعة انزياح في هذا التشغيل، فلا دليل مطلوب.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-space-xs rounded-lg border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
                <span className={cx(t.labelSm, "font-semibold text-on-surface-variant")}>
                  الاقتراح
                </span>
                {suggestion ? (
                  <>
                    <div className={cx(t.body, "rounded-lg bg-surface-container-high/60 p-space-md text-on-surface")}>
                      {suggestion.join("  ·  ")}
                    </div>
                    <p className={cx(t.bodySm, "text-on-surface-variant")}>
                      الاقتراح مأخوذ من المقابلات المعتمدة في الحزمة العلمية، لا مصوغًا هنا.
                    </p>
                  </>
                ) : first ? (
                  <p className={cx(t.bodySm, "text-on-surface-variant")}>
                    لا اقتراح آلي لهذه الواقعة: لا يحمل القيد قائمة مقابلات معتمدة. القرار للمراجع.
                  </p>
                ) : (
                  <p className={cx(t.bodySm, "text-on-surface-variant")}>لا شيء يحتاج تعديلًا.</p>
                )}
              </div>
            </div>
          </div>

          {decisive.length > 0 && (
            <ul className="flex flex-col gap-space-xs">
              {decisive.map((finding, index) => (
                <li
                  key={index}
                  className={cx(
                    "flex flex-wrap items-center gap-space-sm rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm",
                  )}
                >
                  <StatusChip tone={FINDING_TONE[finding.cls]}>{FINDING_LABEL[finding.cls]}</StatusChip>
                  <CodeChip>{finding.layer}</CodeChip>
                  <CodeChip>{finding.kind}</CodeChip>
                  <span dir="auto" className={cx(t.codeMd, "text-on-surface")}>
                    «{finding.span || finding.evidence.source}»
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-space-xs rounded-lg border border-outline-variant bg-surface-container-low p-space-md">
            <span className={cx(t.label, "font-semibold text-on-surface")}>قرار المراجع البشري</span>
            <textarea
              dir="rtl"
              rows={3}
              value={audit.reviewerDecision}
              onChange={(event) => audit.setReviewerDecision(event.target.value)}
              placeholder="اكتب قرارك هنا. القرار جزء من السجل، ويعاد ترميز البصمة عليه."
              className={cx(
                t.body,
                "w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm text-on-surface focus:border-moss-500 focus:outline-none",
              )}
            />
            <p className={cx(t.bodySm, "text-on-surface-variant")}>
              النظام لا يُلغي المراجع: يوجّه نظره إلى الموضع الذي يستحق وقته، ويبقى القرار له.
            </p>
          </div>
        </>
      )}
    </WorkflowCard>
  );
}
