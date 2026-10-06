"use client";

/**
 * Step 5 — الشهادة والسجل.
 *
 * The certificate carries the digest and the identity of everything that
 * produced the verdict; the log is derived from the record rather than
 * narrated, so it cannot claim a step the run did not take.
 *
 * What the seal proves is stated on the panel itself: integrity, attribution
 * and ordering — not the soundness of the Sharia judgement, and not the
 * authenticity of the source text.
 */

import { Icon } from "@/components/ui/Icon";
import { useAudit } from "@/context/AuditContext";
import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";
import { CodeChip, InsetPanel, KeyValue, StatusChip, WorkflowCard } from "./parts";

const VERDICT_LABEL: Record<string, string> = {
  faithful: "مطابق",
  needs_revision: "يحتاج تعديل",
  refer: "وقف وتحويل",
};

export function LedgerSection() {
  const audit = useAudit();
  const record = audit.record;

  if (!record) {
    return (
      <WorkflowCard
        id="step-5"
        number={5}
        title="الشهادة والسجل"
        subtitle="شهادة التدقيق وسجل الإجراءات غير القابل للتعديل"
        aside={<StatusChip tone="neutral">بانتظار الفحص</StatusChip>}
      >
        <InsetPanel>
          <p className={cx(t.body, "text-on-surface-variant")}>
            نفّذ الفحص ليصدر السجل وبصمته.
          </p>
        </InsetPanel>
      </WorkflowCard>
    );
  }

  const log = [
    {
      id: "OP-IN",
      operation: "استلام المدخلات ومطابقة القيود",
      result: `${record.findings.length} واقعة مقابل ${Object.values(record.layerSummary).reduce((a, s) => a + s.checked, 0)} فحصًا`,
      tone: "neutral" as const,
    },
    {
      id: "DET-LAYER-01",
      operation: "الطبقة الحتمية: الأرقام والإحالات ودرجة الثبوت",
      result: `${record.layerSummary.L1.checked} فحصًا · ${record.layerSummary.L1.shifted + record.layerSummary.L1.missing} مخالفة`,
      tone: record.layerSummary.L1.shifted + record.layerSummary.L1.missing > 0 ? ("escalate" as const) : ("verified" as const),
    },
    {
      id: "LEX-LAYER-02",
      operation: "الطبقة المعجمية: المصطلح وقوة الحكم والشرط",
      result: `${record.layerSummary.L2.checked} فحصًا · ${record.layerSummary.L2.shifted + record.layerSummary.L2.missing} مخالفة`,
      tone: record.layerSummary.L2.shifted + record.layerSummary.L2.missing > 0 ? ("escalate" as const) : ("verified" as const),
    },
    {
      id: "SEM-LAYER-03",
      operation: "الطبقة الدلالية: وقائع النموذج بعد التحقق من الاقتباس",
      result: record.model.id
        ? `${record.findings.filter((f) => f.layer === "L3").length} واقعة · ${record.model.id}`
        : "لم تُشغَّل: لا ربط نموذج في هذا التشغيل",
      tone: record.model.id ? ("verified" as const) : ("neutral" as const),
    },
    {
      id: "VRD-RESOLVER",
      operation: "إصدار الحكم وختم السجل",
      result: VERDICT_LABEL[record.verdict] ?? record.verdict,
      tone: record.verdict === "faithful" ? ("verified" as const) : record.verdict === "refer" ? ("neutral" as const) : ("revision" as const),
    },
  ];

  return (
    <WorkflowCard
      id="step-5"
      number={5}
      title="الشهادة والسجل"
      subtitle="شهادة التدقيق وسجل الإجراءات، وكل ما يلزم لإعادة الوصول إلى الحكم نفسه"
      aside={<CodeChip>الحفظ: SHA-256</CodeChip>}
    >
      <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-3">
        <div className="flex flex-col justify-between gap-space-md rounded-xl border border-outline-variant bg-surface-container-low p-space-lg shadow-sm">
          <div className="flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <span className={cx(t.label, "font-semibold text-on-surface")}>شهادة الفحص</span>
              <StatusChip
                tone={record.verdict === "faithful" ? "verified" : record.verdict === "refer" ? "neutral" : "revision"}
              >
                {record.verdict.toUpperCase()}
              </StatusChip>
            </div>

            <div className="rounded-xs border border-outline-variant bg-surface-container-lowest p-space-md">
              <span className={cx(t.code, "block text-on-surface-variant")}>بصمة السجل (SHA-256)</span>
              <span
                dir="ltr"
                className={cx(t.code, "mt-1 block break-all font-mono-telemetry text-primary select-all")}
              >
                {record.digest}
              </span>
            </div>

            <div className="font-body-sm">
              <KeyValue label="إصدار المحرك:" value={record.engineVersion} mono />
              <KeyValue label="إصدار بنك القيود:" value={record.bank.version} mono />
              <KeyValue
                label="النموذج المستعمل:"
                value={record.model.id ?? "لم يُستعمل نموذج"}
                mono
                tone={record.model.id ? undefined : "revision"}
              />
              <KeyValue
                label="بصمة قالب الطلب:"
                value={record.model.promptHash ? `${record.model.promptHash.slice(0, 12)}…` : "—"}
                mono
              />
              <KeyValue label="تاريخ الإصدار:" value={record.createdAt} mono />
              <KeyValue
                label="قرار المراجع:"
                value={record.reviewerDecision ?? "لم يُسجَّل بعد"}
                tone={record.reviewerDecision ? "verified" : "revision"}
              />
            </div>
          </div>

          <div className="flex gap-space-xs pt-space-md">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(JSON.stringify(record, null, 2));
              }}
              className={cx(
                t.labelSm,
                "flex w-full items-center justify-center gap-space-xs rounded-xs bg-surface-container py-2 text-on-surface transition-colors hover:bg-surface-container-high",
              )}
            >
              <Icon name="data_object" className="text-[16px]" />
              نسخ السجل (JSON)
            </button>
            <button
              type="button"
              onClick={() => void audit.verify()}
              className={cx(
                t.labelSm,
                "flex w-full items-center justify-center gap-space-xs rounded-xs bg-primary py-2 font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary-container",
              )}
            >
              <Icon name="fact_check" className="text-[16px]" />
              تحقق من السجل
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-space-md rounded-xl border border-outline-variant bg-surface-container-low p-space-lg shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className={cx(t.label, "font-semibold text-on-surface")}>سجل العملية ومسار التدقيق</span>
            <span className={cx(t.code, "text-on-surface-variant")}>{log.length} عمليات بالترتيب</span>
          </div>

          <div className="overflow-x-auto">
            <table className={cx(t.code, "w-full text-right")}>
              <thead>
                <tr className="bg-surface-container text-on-surface-variant">
                  <th className="rounded-r p-space-xs">التسلسل</th>
                  <th className="p-space-xs">العملية المنجزة</th>
                  <th className="p-space-xs">المعرف</th>
                  <th className="rounded-l p-space-xs">النتيجة</th>
                </tr>
              </thead>
              <tbody className="text-on-surface">
                {log.map((row, index) => (
                  <tr key={row.id} className="hover:bg-surface-container/50">
                    <td className="p-space-xs text-on-surface-variant">{index + 1}</td>
                    <td className="p-space-xs text-on-surface">{row.operation}</td>
                    <td className="p-space-xs text-on-surface-variant">{row.id}</td>
                    <td className="p-space-xs">
                      <StatusChip tone={row.tone}>{row.result}</StatusChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {audit.verification && (
            <div
              className={cx(
                "rounded-lg border p-space-sm",
                audit.verification.ok
                  ? "border-tertiary-fixed-dim bg-tertiary-fixed/30"
                  : "border-error bg-error-container/40",
              )}
            >
              <StatusChip tone={audit.verification.ok ? "verified" : "escalate"}>
                {audit.verification.ok ? "السجل سليم" : "السجل غير سليم"}
              </StatusChip>
              <ul className="mt-space-xs flex flex-col gap-1">
                {audit.verification.notes.map((note, index) => (
                  <li key={index} className={cx(t.bodySm, "text-on-surface-variant")}>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-auto rounded-xs border border-outline-variant bg-surface-container-lowest p-space-sm">
            <div className={cx(t.bodySm, "flex items-start gap-space-xs text-on-surface-variant")}>
              <Icon name="info" className="mt-0.5 text-[16px] text-outline" />
              <span>
                البصمة تثبت السلامة والنسبة والترتيب، ولا تثبت صحة الحكم الشرعي ولا صحة النص الأصلي؛ وكلاهما
                مسؤولية المراجع المختص.
              </span>
            </div>
          </div>

          <details className="rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm">
            <summary className={cx(t.labelSm, "cursor-pointer font-semibold text-on-surface")}>
              السجل الكامل (JSON)
            </summary>
            <pre
              dir="ltr"
              className={cx(t.code, "mt-space-sm max-h-80 overflow-auto font-mono-telemetry text-on-surface")}
            >
              {JSON.stringify(record, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </WorkflowCard>
  );
}
