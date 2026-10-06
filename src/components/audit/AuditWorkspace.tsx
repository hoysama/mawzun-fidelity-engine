"use client";

/**
 * The audit workspace.
 *
 * One scrolling page with a numbered section per stage: a heading band carrying
 * the page title, then the five workflow cards in order. A stage is a section
 * rather than a route.
 */

import { useEffect, useRef } from "react";
import { useAudit } from "@/context/AuditContext";
import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";
import { Icon } from "@/components/ui/Icon";
import { StatusChip } from "@/components/audit/parts";
import { InputSection } from "@/components/audit/InputSection";
import { ConstraintsSection } from "@/components/audit/ConstraintsSection";
import { PipelineSection } from "@/components/audit/PipelineSection";
import { VerdictSection } from "@/components/audit/VerdictSection";
import { LedgerSection } from "@/components/audit/LedgerSection";

export function AuditWorkspace() {
  const audit = useAudit();

  /**
   * Steps two to five describe the output of a run, so they stay out of the page
   * until there is an output. An empty «الطبقة 01» panel is not a neutral thing
   * to show a reviewer — it reads as a finding of nothing.
   */
  const revealed = audit.result !== null;

  // When a run completes, the newly opened sections are below the fold. Move the
  // reader to the first of them rather than leaving the result off-screen.
  const wasRevealed = useRef(false);
  useEffect(() => {
    if (revealed && !wasRevealed.current) {
      wasRevealed.current = true;
      document.getElementById("step-2")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (!revealed) wasRevealed.current = false;
  }, [revealed]);

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-space-xl px-margin-desktop py-space-xl">
        <InputSection />

        {!revealed && (
          <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-space-xl">
            <div className="flex items-start gap-space-md">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-moss-100 text-moss-700">
                <Icon name="lock" className="text-base" />
              </span>
              <div className="flex flex-col gap-space-xs">
                <h2 className={cx(t.h2, "text-on-surface")}>بقية الأقسام تُفتح بعد التنفيذ</h2>
                <p className={cx(t.body, "text-on-surface-variant")}>
                  كل قسم بعد هذه الخطوة يُبنى على نتيجة فحصك أنت، لا على مثال جاهز.
                </p>
                {audit.isRunning && (
                  <StatusChip tone="revision" icon="progress_activity">
                    جارٍ تنفيذ الفحص…
                  </StatusChip>
                )}
              </div>
            </div>
          </div>
        )}

        {revealed && (
          <>
            <div className="reveal reveal-1">
              <ConstraintsSection />
            </div>
            <div className="reveal reveal-2">
              <PipelineSection />
            </div>
            <div className="reveal reveal-3">
              <VerdictSection />
            </div>
            <div className="reveal reveal-4">
              <LedgerSection />
            </div>
          </>
        )}
      </div>

    </div>
  );
}
