"use client";

/**
 * Step 1 — الإدخال والتوصيف.
 *
 * The four inputs of the specification: the source text, the derived text, the
 * work type and the content level. The fingerprints under each textarea are real
 * SHA-256 prefixes, not decoration — the record carries the full digests, so a
 * reader can confirm the text they are looking at is the text that was audited.
 */

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useAudit } from "@/context/AuditContext";
import { sha256Hex } from "@/lib/audit";
import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";
import type { ContentLevel, WorkType } from "@/lib/audit/types";
import { CodeChip, StatusChip, WorkflowCard } from "./parts";

const WORK_TYPES: { id: WorkType; label: string }[] = [
  { id: "translate", label: "ترجمة" },
  { id: "summarize", label: "تلخيص" },
  { id: "paraphrase", label: "إعادة صياغة" },
];

const LEVELS: { id: ContentLevel; label: string }[] = [
  { id: "A", label: "المستوى أ" },
  { id: "B", label: "المستوى ب" },
  { id: "C", label: "المستوى ج" },
  { id: "D", label: "المستوى د" },
];

export const EXAMPLE = {
  sourceText: "لا يجوز بيع الطعام قبل قبضه، ويجب على البائع بيانه للمشتري.",
  derivedText:
    "It is not recommended to sell food before taking possession, and the seller must clarify it to the buyer.",
};

/**
 * Real fingerprint of the text, shown as a short prefix. Returns null until the
 * digest resolves; the caller renders "—" for blank text, so the effect body
 * never calls setState synchronously.
 */
function useShortHash(text: string): string | null {
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!text.trim()) return;
    void sha256Hex(text).then((value) => {
      if (!cancelled) setHash(`${value.slice(0, 6)}…${value.slice(-4)}`);
    });
    return () => {
      cancelled = true;
    };
  }, [text]);
  return hash;
}

function Pills<T extends string>({
  label,
  options,
  value,
  onChange,
  columns,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  columns: string;
}) {
  return (
    <div className="flex flex-col gap-space-xs">
      <span className={cx(t.label, "font-semibold text-on-surface")}>{label}</span>
      <div className={cx("grid gap-space-xs", columns)}>
        {options.map((option) => (
          <label key={option.id} className="cursor-pointer">
            <input
              className="peer sr-only"
              type="radio"
              name={label}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />
            <span
              className={cx(
                t.labelSm,
                "block rounded-pill py-2 px-space-xs text-center shadow-sm transition-colors",
                value === option.id
                  ? "bg-moss-600 text-on-primary"
                  : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container",
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function InputSection() {
  const audit = useAudit();
  const sourceHash = useShortHash(audit.sourceText);
  const derivedHash = useShortHash(audit.derivedText);
  const words = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

  // The audit can start from the source alone: a pasted hadith or verse is
  // enough to run. The derived text is optional, and the engine reports an
  // absent transmission honestly (every source element comes back missing)
  // rather than blocking the run. Only the source gates the button.
  const ready = audit.sourceText.trim().length > 0;

  return (
    <WorkflowCard
      id="step-1"
      number={1}
      title="الإدخال والتوصيف"
    >
      <div className="grid grid-cols-1 gap-space-md rounded-lg border border-outline-variant bg-surface-container-low p-space-md md:grid-cols-3">
        <Pills
          label="نوع العمل"
          options={WORK_TYPES}
          value={audit.workType}
          onChange={audit.setWorkType}
          columns="grid-cols-3"
        />
        <Pills
          label="مستوى المحتوى"
          options={LEVELS}
          value={audit.contentLevel}
          onChange={audit.setContentLevel}
          columns="grid-cols-4"
        />
        <div className="flex flex-col gap-space-xs">
          <span className={cx(t.label, "font-semibold text-on-surface")}>اللغة الهدف</span>
          <span
            className={cx(
              t.labelSm,
              "rounded-lg border border-outline-variant bg-surface-container-lowest px-space-sm py-2 text-on-surface",
            )}
          >
            الإنجليزية
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-2">
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center justify-between">
            <label
              htmlFor="original-text"
              className={cx(t.label, "flex items-center gap-space-xs font-semibold text-on-surface")}
            >
              <span className="h-2 w-2 rounded-full bg-moss-500" />
              النص الأصلي
            </label>
            <CodeChip>المرجع: الحزمة العلمية المعتمدة</CodeChip>
          </div>
          <textarea
            id="original-text"
            dir="rtl"
            rows={7}
            value={audit.sourceText}
            onChange={(event) => audit.setSourceText(event.target.value)}
            placeholder="الصق النص الشرعي الأصلي هنا."
            className={cx(
              t.body,
              "w-full resize-y rounded-lg border border-outline-variant bg-surface-container-low p-space-md leading-relaxed text-on-surface transition-colors focus:border-moss-500 focus:bg-surface-container-lowest focus:outline-none",
            )}
          />
          <div className={cx(t.code, "flex items-center justify-between px-1 text-on-surface-variant")}>
            <span>عدد الكلمات: {words(audit.sourceText)}</span>
            <span>بصمة النص: {audit.sourceText.trim() ? (sourceHash ?? "…") : "—"}</span>
          </div>
        </div>

        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center justify-between">
            <label
              htmlFor="derived-text"
              className={cx(t.label, "flex items-center gap-space-xs font-semibold text-on-surface")}
            >
              <span className="h-2 w-2 rounded-full bg-moss-800" />
              النص المشتق
            </label>
            <CodeChip>مخرج خاضع للمراجعة</CodeChip>
          </div>
          <textarea
            id="derived-text"
            dir="auto"
            rows={7}
            value={audit.derivedText}
            onChange={(event) => audit.setDerivedText(event.target.value)}
            placeholder="الصق الترجمة أو الملخّص أو إعادة الصياغة هنا."
            className={cx(
              t.body,
              "w-full resize-y rounded-lg border border-outline-variant bg-surface-container-low p-space-md leading-relaxed text-on-surface transition-colors focus:border-moss-500 focus:bg-surface-container-lowest focus:outline-none",
            )}
          />
          <div className={cx(t.code, "flex items-center justify-between px-1 text-on-surface-variant")}>
            <span>عدد الكلمات: {words(audit.derivedText)}</span>
            <span>بصمة النص: {audit.derivedText.trim() ? (derivedHash ?? "…") : "—"}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-space-sm">
        <button
          type="button"
          onClick={() => void audit.run()}
          disabled={audit.isRunning || !ready}
          className={cx(
            t.label,
            "inline-flex items-center gap-space-xs rounded-pill bg-moss-600 px-space-xl py-3 font-semibold text-on-primary transition-colors hover:bg-moss-700 disabled:opacity-40",
          )}
        >
          <Icon name="play_arrow" className="text-base" />
          {audit.isRunning ? "جارٍ الفحص…" : "نفّذ الفحص ثلاثي الطبقات"}
        </button>
        <button
          type="button"
          onClick={() => {
            audit.setSourceText(EXAMPLE.sourceText);
            audit.setDerivedText(EXAMPLE.derivedText);
            audit.setContentLevel("B");
            audit.setWorkType("translate");
            audit.setTargetLanguage("en");
          }}
          className={cx(
            t.label,
            "inline-flex items-center gap-space-xs rounded-pill border border-moss-200 px-space-md py-2 font-semibold text-on-surface-variant transition-colors hover:bg-moss-100",
          )}
        >
          <Icon name="experiment" className="text-base" />
          حمّل مثال الانزياح
        </button>
        <button
          type="button"
          onClick={audit.reset}
          className={cx(
            t.label,
            "inline-flex items-center gap-space-xs rounded-pill px-space-sm py-2 text-on-surface-variant transition-colors hover:bg-moss-100",
          )}
        >
          <Icon name="restart_alt" className="text-base" />
          تهيئة
        </button>
        {audit.error && (
          <StatusChip tone="escalate" icon="error">
            {audit.error}
          </StatusChip>
        )}
      </div>
    </WorkflowCard>
  );
}
