"use client";

/**
 * Step 3 — الفحص ثلاثي الطبقات.
 *
 * The three layers are shown side by side and never blended into one number,
 * because each carries a different strength of proof: the first two are lookups
 * over imported tables and cannot be argued with, the third is a model's
 * structured findings gated on verbatim quotes.
 *
 * The three questions of the semantic layer are answered from the findings
 * themselves. When the layer did not run, each question says so — an unchecked
 * question must never read as a passed one.
 */

import { useAudit } from "@/context/AuditContext";
import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";
import type { Finding, LayerId } from "@/lib/audit/types";
import {
  CitationList,
  CodeChip,
  FINDING_LABEL,
  FINDING_TONE,
  HighlightedText,
  InsetPanel,
  StatusChip,
  WorkflowCard,
} from "./parts";
import { SourcesPanel } from "./SourcesPanel";

const LAYERS: { id: LayerId; ordinal: string; title: string; note: string }[] = [
  {
    id: "L1",
    ordinal: "الطبقة 01",
    title: "الحتمية",
    note: "بلا ذكاء اصطناعي: الأرقام والإحالات وألفاظ درجة الثبوت، مقارنة وجود ومطابقة.",
  },
  {
    id: "L2",
    ordinal: "الطبقة 02",
    title: "المعجمية",
    note: "ضبط المسرد والمصطلح، وقوة الحكم، وأدوات الشرط، بحثًا في جداول معتمدة.",
  },
  {
    id: "L3",
    ordinal: "الطبقة 03",
    title: "الدلالية",
    note: "وقائع منظّمة من نموذج، وكل اقتباس يُتحقق من وجوده في النص حرفيًا.",
  },
];

const QUESTIONS: { kind: Finding["kind"]; text: string }[] = [
  { kind: "condition", text: "هل بقي الشرط؟" },
  { kind: "isnad", text: "هل صحت النسبة؟" },
  { kind: "ruling", text: "هل حُفظت قوة الحكم؟" },
];

export function PipelineSection() {
  const audit = useAudit();
  const result = audit.result;
  const l3Ran = audit.record?.model?.id != null;
  const layerFindings = (layer: LayerId) => result?.findings.filter((f) => f.layer === layer) ?? [];

  const coverage = result?.coverage ?? [];
  // How many citations the run actually attached, so the sources panel can say
  // plainly whether anything was consulted rather than implying agreement.
  const citationCount =
    result?.findings.reduce((total, finding) => total + (finding.citations?.length ?? 0), 0) ?? 0;

  return (
    <WorkflowCard
      id="step-3"
      number={3}
      title="الفحص"
      subtitle="ثلاث طبقات صارمة دون خلط مفاهيمي، ولكل طبقة قوة إثبات مختلفة"
      aside={
        <span className={cx(t.code, "flex items-center gap-space-sm text-on-surface-variant")}>
          <span
            className={cx(
              "h-2 w-2 rounded-full",
              audit.isRunning ? "animate-pulse bg-secondary" : result ? "bg-tertiary-container" : "bg-outline",
            )}
          />
          {audit.isRunning
            ? "جارٍ التنفيذ"
            : result
              ? `اكتمل الفحص · ${result.findings.length} واقعة`
              : "لم يُنفَّذ فحص بعد"}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-space-md md:grid-cols-3">
        {LAYERS.map((layer) => {
          const summary = result?.layerSummary[layer.id];
          const findings = layerFindings(layer.id);
          const ran = layer.id !== "L3" || l3Ran;
          const hasIssue = (summary?.shifted ?? 0) + (summary?.missing ?? 0) > 0;

          return (
            <div
              key={layer.id}
              className="flex flex-col justify-between gap-space-md rounded-xl border border-outline-variant bg-surface-container-low p-space-lg"
            >
              <div className="flex flex-col gap-space-sm">
                <div className="flex items-center justify-between">
                  <span className={cx(t.labelSm, "font-semibold text-primary")}>{layer.ordinal}</span>
                  {!result ? (
                    <StatusChip tone="neutral">بانتظار التنفيذ</StatusChip>
                  ) : !ran ? (
                    <StatusChip tone="neutral" icon="help">
                      لم تُشغَّل
                    </StatusChip>
                  ) : hasIssue ? (
                    <StatusChip tone="escalate">
                      {summary?.shifted ?? 0} انزياح · {summary?.missing ?? 0} مفقود
                    </StatusChip>
                  ) : (
                    <StatusChip tone="verified" icon="check">
                      لا مخالفة
                    </StatusChip>
                  )}
                </div>

                <h3 className={cx(t.h4, "text-on-surface")}>{layer.title}</h3>
                <p className={cx(t.bodySm, "text-on-surface-variant")}>{layer.note}</p>

                {layer.id === "L3" ? (
                  <div className="mt-space-sm flex flex-col gap-space-xs">
                    {QUESTIONS.map((question) => {
                      const hits = findings.filter((f) => f.kind === question.kind && f.cls !== "preserved");
                      const preserved = findings.filter((f) => f.kind === question.kind && f.cls === "preserved");
                      return (
                        <InsetPanel key={question.text} className="bg-surface-container-lowest">
                          <div className={cx(t.labelSm, "font-semibold text-on-surface")}>{question.text}</div>
                          {!l3Ran ? (
                            <div className={cx(t.bodySm, "text-on-surface-variant")}>
                              لم تُفحص: الطبقة الدلالية لم تُشغَّل في هذا التشغيل.
                            </div>
                          ) : hits.length > 0 ? (
                            <div className={cx(t.bodySm, "text-error")}>
                              {hits
                                .map((f) => f.evidence.note || `${FINDING_LABEL[f.cls]}: ${f.span}`)
                                .join(" · ")}
                            </div>
                          ) : preserved.length > 0 ? (
                            <div className={cx(t.bodySm, "text-on-tertiary-fixed-variant")}>
                              نعم، محفوظ: {preserved.map((f) => f.span).join(" · ")}
                            </div>
                          ) : (
                            <div className={cx(t.bodySm, "text-on-surface-variant")}>
                              لا واقعة مسجّلة لهذا السؤال. الامتناع مقبول وهو أفضل من التخمين.
                            </div>
                          )}
                        </InsetPanel>
                      );
                    })}
                  </div>
                ) : (
                  <InsetPanel className="bg-surface-container-lowest">
                    {findings.length === 0 ? (
                      <div className={cx(t.code, "text-on-surface-variant")}>
                        {result ? "لا واقعة في هذه الطبقة" : "بانتظار التنفيذ"}
                      </div>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {findings.slice(0, 4).map((finding, index) => (
                          <li key={index} className={cx(t.code, "flex items-center justify-between gap-space-xs")}>
                            <span className="truncate text-on-surface-variant">{finding.span || "—"}</span>
                            <span
                              className={
                                finding.cls === "preserved" ? "text-on-tertiary-fixed-variant" : "text-error"
                              }
                            >
                              {FINDING_LABEL[finding.cls]}
                            </span>
                          </li>
                        ))}
                        {findings.length > 4 && (
                          <li className={cx(t.code, "text-outline")}>و{findings.length - 4} أخرى…</li>
                        )}
                      </ul>
                    )}
                  </InsetPanel>
                )}
              </div>

              <div className={cx(t.code, "pt-space-md text-on-surface-variant")}>
                {layer.id === "L1" && "DET-QUOTE+NUMERIC"}
                {layer.id === "L2" && "LEXICON+FORCE-TABLE"}
                {layer.id === "L3" && (audit.record?.model?.id ?? "MODEL-NOT-RUN")}
              </div>
            </div>
          );
        })}
      </div>

      {result && (
        <>
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <span className={cx(t.label, "font-semibold text-on-surface")}>النص المشتق بمواضع الانزياح</span>
              <CodeChip>
                {result.findings.filter((f) => f.end > f.start).length} موضعًا محددًا
              </CodeChip>
            </div>
            <InsetPanel>
              <HighlightedText text={audit.derivedText} findings={result.findings} />
            </InsetPanel>
          </div>

          {result.findings.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className={cx(t.labelSm, "bg-surface-container-low text-on-surface-variant")}>
                    <th className="rounded-r px-space-md py-2 font-semibold">الطبقة</th>
                    <th className="px-space-md py-2 font-semibold">النوع</th>
                    <th className="px-space-md py-2 font-semibold">الحالة</th>
                    <th className="px-space-md py-2 font-semibold">الموضع</th>
                    <th className="rounded-l px-space-md py-2 font-semibold">الواقعة</th>
                  </tr>
                </thead>
                <tbody>
                  {result.findings.map((finding, index) => (
                    <tr key={index} className="border-t border-surface-container-high align-top">
                      <td className={cx(t.code, "px-space-md py-space-sm text-on-surface-variant")}>
                        {finding.layer}
                      </td>
                      <td className={cx(t.bodySm, "px-space-md py-space-sm text-on-surface")}>
                        {finding.kind}
                      </td>
                      <td className="px-space-md py-space-sm">
                        <StatusChip tone={FINDING_TONE[finding.cls]}>{FINDING_LABEL[finding.cls]}</StatusChip>
                      </td>
                      <td className={cx(t.code, "px-space-md py-space-sm text-on-surface-variant")}>
                        {finding.end > finding.start ? `${finding.start}:${finding.end}` : "—"}
                      </td>
                      <td className="px-space-md py-space-sm">
                        <p className={cx(t.bodySm, "text-on-surface")}>
                          {finding.evidence.note}
                        </p>
                        {finding.span && (
                          <p dir="auto" className={cx(t.codeMd, "mt-1 text-on-surface-variant")}>
                            «{finding.span}»
                          </p>
                        )}
                        {finding.citations && finding.citations.length > 0 && (
                          <div className="mt-space-sm">
                            <CitationList citations={finding.citations} />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <SourcesPanel citationCount={citationCount} />

          <div className="rounded-lg border border-outline-variant bg-surface-container-low p-space-md">
            <div className={cx(t.label, "mb-space-xs font-semibold text-on-surface")}>
              ما لم يُفحص في هذا التشغيل
            </div>
            {coverage.length === 0 ? (
              <p className={cx(t.bodySm, "text-on-surface-variant")}>لا فجوة معلنة.</p>
            ) : (
              <ul className="flex flex-col gap-space-xs">
                {coverage.map((note, index) => (
                  <li key={index} className="flex items-start gap-space-sm">
                    <CodeChip>{note.layer}</CodeChip>
                    <span className={cx(t.bodySm, "text-on-surface-variant")}>{note.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </WorkflowCard>
  );
}
