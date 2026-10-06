"use client";

import React from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";
import { useToast } from "@/context/ToastContext";
import { useAudit } from "@/context/AuditContext";

/**
 * Settings.
 *
 * The previous version exposed strictness levels, an auto-repair switch and an
 * audio toggle — none of which changed any behaviour. A control that does
 * nothing is worse than no control, so this screen now states where the real
 * policy lives and offers the one action that has an effect: clearing the run.
 *
 * Strictness is a property of the constraint bank, not of a slider: what is
 * checked is what the bank declares, and the bank travels in the record.
 */
export function SettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { reset } = useAudit();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-16 bg-inverse-surface/20 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-surface-container-lowest p-5 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-container pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-moss-100 text-moss-700">
              <Icon name="tune" className="text-base" />
            </span>
            <span className={cx(t.label, "font-bold text-on-surface")}>أين تُضبط السياسة؟</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-outline hover:text-on-surface p-1 rounded-pill"
            aria-label="إغلاق الإعدادات"
          >
            <Icon name="close" className="text-base" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className={cx(t.labelSm, "font-semibold text-on-surface")}>بنك القيود</span>
            <span className={cx(t.bodySm, "leading-relaxed text-on-surface-variant")}>
              المصطلحات ومقابلاتها المعتمدة والممنوعة، مستوردة من الحزمة العلمية المعتمدة. من هنا يُتحكَّم في
              صرامة الفحص، لا من مفتاح في الواجهة.
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className={cx(t.labelSm, "font-semibold text-on-surface")}>جدول قوة الحكم</span>
            <span className={cx(t.bodySm, "leading-relaxed text-on-surface-variant")}>
              لكل لفظ حكمي قوته ومقابلاته في كل لغة. الفحص بحث في هذا الجدول، ونتيجته قابلة لإعادة الإنتاج.
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className={cx(t.labelSm, "font-semibold text-on-surface")}>نطاق الفحص</span>
            <span className={cx(t.bodySm, "leading-relaxed text-on-surface-variant")}>
              ما لم يُفحص يُعلن في الحكم وفي السجل. لا يوجد مفتاح يوسّع النطاق صامتًا.
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-surface-container">
          <button
            type="button"
            onClick={() => {
              reset();
              toast({ title: "تم مسح تشغيل الفحص الحالي", variant: "info" });
              onClose();
            }}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-pill text-error hover:bg-error-container/40 transition-colors font-label-sm text-xs font-semibold"
          >
            <Icon name="restart_alt" className="text-sm" />
            مسح المدخلات والسجل الحالي
          </button>
        </div>
      </div>
    </div>
  );
}
