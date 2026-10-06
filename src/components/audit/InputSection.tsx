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

/**
 * The four levels exactly as the organiser's reference package defines them,
 * with what موزون does at each one beside them.
 *
 * The level is not a severity dial: it decides how far the output may go. At
 * (أ) a direct, sourced statement is owed; at (ب) certainty must not be claimed
 * where there is room for difference; at (ج) the answer is bound to what is
 * approved or referred onward; at (د) no independent ruling may be given at all.
 * موزون measures transmission, so quoting the level's own wording keeps a
 * reviewer from reading its verdict as broader than the level allows.
 */
const LEVEL_MEANING: Record<ContentLevel, { scope: string; handling: string }> = {
  A: {
    scope:
      "أصول الإسلام وأركانه، والقرآن الكريم، والأحاديث الصحيحة المعتمدة، والسيرة، والعقيدة، والقيم، والمعلومات التعريفية المستقرة.",
    handling:
      "فحص كامل: القيود الحتمية والمعجمية، والمطابقة الحرفية للاقتباس القرآني. الأصل في هذا المستوى الإجابة المباشرة الموثقة بالمصدر.",
  },
  B: {
    scope:
      "شرح المفاهيم، والمقارنات، ومقاصد التشريع، والإجابة عن الأسئلة الفكرية والشبهات العامة.",
    handling:
      "فحص كامل، ولا يُوصف الانزياح بحكم شرعي ولا يُبنى عليه قطع؛ يظهر المرجع ولا يُدَّعى القطع فيما يحتمل الخلاف.",
  },
  C: {
    scope:
      "المسائل العقدية التفصيلية، والخلاف الفقهي، والمسائل الجدلية، والقضايا التاريخية التي تتطلب تحريًا علميًا خاصًا.",
    handling:
      "فحص كامل، وكل انزياح يُحال إلى المختص ولا يُبتّ فيه؛ والإجابة مقيَّدة بما هو معتمد أو ببيان وجوده أو بالامتناع.",
  },
  D: {
    scope: "مسائل قانونية، ونزاع أسري، وحكم على واقع فردي، وصحة عقد أو عبادة، وأثر طبي شخصي.",
    handling:
      "لا يُفحص ولا يُحكم فيه: النظام يتوقف ويحوّل إلى جهة مؤهلة. الوقف هنا نتيجة معتبرة لا فشل.",
  },
};

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

  const ready = audit.sourceText.trim().length > 0 && audit.derivedText.trim().length > 0;

  return (
    <WorkflowCard
      id="step-1"
      number={1}
      title="الإدخال والتوصيف"
      subtitle="النص الأصلي المرجعي والنص المشتق الخاضع للمراجعة"
      aside={
        <StatusChip tone={ready ? "verified" : "neutral"} icon={ready ? "check" : "pending"}>
          {ready ? "جاهز للفحص" : "بانتظار المدخلات"}
        </StatusChip>
      }
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
          <select
            value={audit.targetLanguage}
            onChange={(event) => audit.setTargetLanguage(event.target.value)}
            className={cx(
              t.labelSm,
              "rounded-lg border border-outline-variant bg-surface-container-lowest px-space-sm py-2 text-on-surface",
            )}
          >
            <option value="en">الإنجليزية</option>
            <option value="fr">الفرنسية</option>
          </select>
          <span className={cx(t.bodySm, "text-on-surface-variant")}>
            بنك القيود يحمل مقابلات معتمدة لهاتين اللغتين.
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-outline-variant bg-surface-container-low p-space-md">
        <p className={cx(t.labelSm, "font-semibold text-on-surface")}>
          ضبط الاستجابة — {LEVELS.find((level) => level.id === audit.contentLevel)?.label}
        </p>
        <p className={cx(t.bodySm, "mt-space-xs text-on-surface-variant")}>
          <span className="font-medium text-on-surface">نطاق المستوى في الحزمة: </span>
          {LEVEL_MEANING[audit.contentLevel].scope}
        </p>
        <p className={cx(t.bodySm, "mt-space-xs text-on-surface-variant")}>
          <span className="font-medium text-on-surface">ما يفعله موزون هنا: </span>
          {LEVEL_MEANING[audit.contentLevel].handling}
        </p>
        <p className={cx(t.bodySm, "mt-space-sm border-t border-outline-variant pt-space-xs text-on-surface-variant")}>
          موزون أداة مدعومة بالذكاء الاصطناعي: ما يصدره قياسُ أمانةِ نقلٍ بين نصين، لا فتوى، ولا ترجيحٌ لمذهب، ولا حكمٌ على قائل.
        </p>
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
