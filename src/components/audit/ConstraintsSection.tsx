"use client";

/**
 * Step 2 — القيود المعتمدة.
 *
 * The constraint bank, rendered as the design's governance table: what the
 * constraint is, where in the approved package it comes from, and which
 * renderings it allows or rules out. Nothing here is generated at runtime —
 * the table is the imported package, and the record carries the same bank.
 */

import { useMemo, useState } from "react";
import { buildConstraintBank } from "@/lib/audit";
import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";
import { CodeChip, StatusChip, WorkflowCard } from "./parts";

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

function renderings(list: Record<string, readonly string[]>): string {
  return (
    Object.entries(list)
      .filter(([, values]) => values.length > 0)
      .map(([language, values]) => `${language}: ${values.join(" · ")}`)
      .join("  |  ") || "—"
  );
}

export function ConstraintsSection() {
  const bank = useMemo(() => buildConstraintBank(), []);
  const [kind, setKind] = useState("all");

  const rows = kind === "all" ? bank.constraints : bank.constraints.filter((c) => c.kind === kind);

  return (
    <WorkflowCard
      id="step-2"
      number={2}
      title="القيود المعتمدة (Approved Constraints)"
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
              "rounded-xs px-space-sm py-1 font-medium transition-colors",
              kind === filter.id
                ? "bg-primary text-on-primary"
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
            <tr className={cx(t.labelSm, "bg-surface-container-low text-on-surface-variant")}>
              <th className="rounded-r px-space-md py-2.5">التصنيف</th>
              <th className="px-space-md py-2.5">القيد المعتمد ونصه</th>
              <th className="px-space-md py-2.5">المصدر في الحزمة</th>
              <th className="rounded-l px-space-md py-2.5">المقابلات</th>
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
                      "inline-flex rounded-xs bg-surface-container px-space-sm py-0.5 font-medium text-on-surface",
                    )}
                  >
                    {KIND_LABEL[constraint.kind] ?? constraint.kind}
                  </span>
                  <div className={cx(t.code, "mt-1 text-outline")}>{constraint.id}</div>
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
                  <div className="flex flex-col gap-1">
                    <span className={cx(t.code, "text-on-tertiary-fixed-variant")}>
                      معتمد: {renderings(constraint.approved)}
                    </span>
                    <span className={cx(t.code, "text-error")}>
                      ممنوع: {renderings(constraint.forbidden)}
                    </span>
                  </div>
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
