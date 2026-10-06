"use client";

/**
 * Step 2 — القيود المعتمدة.
 *
 * The constraint bank, rendered as the design's governance table, but the last
 * column is a RESULT: for every constraint, the state this run actually
 * measured for it.
 *
 * Attribution is by the finding's own `constraintId`, which the engine stamps on
 * every finding it emits (layer 1 for `isnad` and `number`, layer 2 for `term`,
 * `ruling`, `condition` and `restriction`). Nothing here is matched by text: an
 * id is read, or the finding is not attributed. A finding whose `constraintId`
 * is `null` — a Qur'anic quotation, a numeric reference, a layer-3 semantic
 * note — belongs to no row of the bank, so it can never make a row claim a
 * state. A constraint the run produced no attributed finding for stays
 * «لم يُفحص»: silence is not a match, and an unmeasured constraint is shown as
 * unmeasured rather than as preserved.
 *
 * The approved and forbidden renderings are deliberately absent from this
 * column — it reports what happened, not what the package allows. They are read
 * where they still belong, backing the suggested correction in `VerdictSection`.
 */

import { useMemo, useState } from "react";
import { buildConstraintBank } from "@/lib/audit";
import { useAudit } from "@/context/AuditContext";
import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";
import type { Finding, FindingClass } from "@/lib/audit/types";
import { CodeChip, FINDING_TONE, StatusChip, WorkflowCard } from "./parts";

/** The match column's vocabulary: a constraint either travelled, drifted, or was dropped. */
const MATCH_LABEL = {
  preserved: "مطابق",
  shifted: "منزاح",
  missing: "مفقود",
} as const;

const KIND_LABEL: Record<string, string> = {
  term: "المصطلح",
  ruling: "الحكم",
  condition: "الشرط",
  restriction: "الحصر",
  isnad: "السند",
  number: "الأرقام",
};

const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "term", label: "المصطلح" },
  { id: "ruling", label: "الحكم" },
  { id: "condition", label: "الشرط" },
  { id: "restriction", label: "الحصر" },
  { id: "isnad", label: "السند" },
  { id: "number", label: "الأرقام" },
];

/**
 * Which classification outranks which when one constraint carries several
 * findings. The cell reports the gravest thing the run found for the
 * constraint, so a single missed item is never hidden by a clean one.
 */
const SEVERITY: Record<FindingClass, number> = { preserved: 0, shifted: 1, missing: 2 };

function ConstraintState({ findings }: { findings: readonly Finding[] }) {
  if (findings.length === 0) {
    // Never «محفوظ» by default: no attributed finding means the run did not
    // measure this constraint, whatever the reason.
    return <StatusChip tone="neutral">لم يُفحص</StatusChip>;
  }

  const worst = findings.reduce((a, b) => (SEVERITY[b.cls] > SEVERITY[a.cls] ? b : a));

  return (
    <div className="flex flex-wrap items-center gap-space-xs">
      <StatusChip tone={FINDING_TONE[worst.cls]}>{MATCH_LABEL[worst.cls]}</StatusChip>
      {findings.length > 1 && <CodeChip>×{findings.length}</CodeChip>}
    </div>
  );
}

export function ConstraintsSection() {
  const bank = useMemo(() => buildConstraintBank(), []);
  const { result } = useAudit();
  const [kind, setKind] = useState("all");

  const rows = kind === "all" ? bank.constraints : bank.constraints.filter((c) => c.kind === kind);

  /**
   * The current run's findings, grouped by the constraint they were stamped
   * with. `null` ids are dropped here on purpose: they are real findings, but
   * they belong to a quotation or a reference check, not to a bank constraint,
   * and attributing one to a row would invent a link the engine never made.
   */
  const findingsByConstraint = useMemo(() => {
    const map = new Map<string, Finding[]>();
    for (const finding of result?.findings ?? []) {
      if (!finding.constraintId) continue;
      const list = map.get(finding.constraintId);
      if (list) list.push(finding);
      else map.set(finding.constraintId, [finding]);
    }
    return map;
  }, [result]);

  return (
    <WorkflowCard
      id="step-2"
      number={2}
      title="القيود المعتمدة"
      subtitle="القيود مستوردة من الحزمة العلمية المعتمدة، لا من رأي النظام، ولكل قيد أصله"
      aside={
        <StatusChip tone="verified" icon="verified">
          الحزمة: {bank.packageName} · v{bank.version}
        </StatusChip>
      }
    >
      <div className="flex flex-wrap items-center gap-space-xs">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setKind(filter.id)}
            className={cx(
              t.labelSm,
              "rounded-pill px-space-sm py-1 font-medium transition-colors",
              kind === filter.id
                ? "bg-moss-600 text-on-primary"
                : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container",
            )}
          >
            {filter.label}
          </button>
        ))}
        <span className={cx(t.code, "ms-auto text-on-surface-variant")}>
          {rows.length} / {bank.constraints.length} قيدًا
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right">
          <thead>
            <tr className={cx(t.labelSm, "bg-moss-50 text-on-surface-variant")}>
              <th className="rounded-r px-space-md py-2.5">التصنيف</th>
              <th className="px-space-md py-2.5">القيد المعتمد ونصه</th>
              <th className="px-space-md py-2.5">المصدر في الحزمة</th>
              <th className="rounded-l px-space-md py-2.5">حالة تطابق</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((constraint) => (
              <tr
                key={constraint.id}
                className="align-top transition-colors hover:bg-surface-container-low/50"
              >
                <td className="px-space-md py-space-md">
                  <span
                    className={cx(
                      t.labelSm,
                      "inline-flex rounded-pill bg-moss-100 px-space-sm py-0.5 font-medium text-moss-800",
                    )}
                  >
                    {KIND_LABEL[constraint.kind] ?? constraint.kind}
                  </span>
                </td>
                <td className="px-space-md py-space-md">
                  <p className={cx(t.body, "text-on-surface")}>{constraint.rule}</p>
                  {constraint.source.length > 0 && (
                    <p className={cx(t.code, "mt-1 text-on-surface-variant")}>
                      {constraint.source.join(" · ")}
                    </p>
                  )}
                </td>
                <td className={cx(t.code, "px-space-md py-space-md text-on-surface-variant")}>
                  {constraint.origin}
                </td>
                <td className="px-space-md py-space-md">
                  <ConstraintState findings={findingsByConstraint.get(constraint.id) ?? []} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={cx(t.bodySm, "flex items-center gap-space-xs text-on-surface-variant")}>
        <CodeChip>bank@{bank.version}</CodeChip>
        <span>السجل يحمل نسخة البنك كاملة وإصداره، فلا يتغيّر قيد دون أن يتغيّر السجل.</span>
      </div>
    </WorkflowCard>
  );
}
