"use client";

/**
 * The audit workspace.
 *
 * One scrolling page with a numbered section per stage, matching the design:
 * a session bar carrying the stepper, the five workflow cards in order, and the
 * footer. Navigation is anchor-based, so a stage is a section rather than a
 * route and the stepper can never point at something that does not exist.
 */

import { useEffect, useRef, useState } from "react";
import { STAGES, unlockedStageIds } from "@/lib/stages";
import { useAudit } from "@/context/AuditContext";
import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";
import { Icon } from "@/components/ui/Icon";
import { StatusChip, Stepper } from "@/components/audit/parts";
import { InputSection } from "@/components/audit/InputSection";
import { ConstraintsSection } from "@/components/audit/ConstraintsSection";
import { PipelineSection } from "@/components/audit/PipelineSection";
import { VerdictSection } from "@/components/audit/VerdictSection";
import { LedgerSection } from "@/components/audit/LedgerSection";

export function AuditWorkspace() {
  const audit = useAudit();
  const [activeId, setActiveId] = useState(STAGES[0].id);

  /**
   * Steps two to five describe the output of a run, so they stay out of the page
   * until there is an output. An empty «الطبقة 01» panel is not a neutral thing
   * to show a reviewer — it reads as a finding of nothing.
   */
  const revealed = audit.result !== null;
  const unlockedIds = unlockedStageIds(revealed);

  // Highlight the step whose section occupies the reading position. Re-run when
  // the later sections are mounted, or there would be nothing to observe.
  useEffect(() => {
    const sections = unlockedIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.1, 0.5, 1] },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [unlockedIds]);

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
      <div className="w-full bg-surface-container-low px-margin-desktop py-space-md shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-space-md md:flex-row md:items-center">
          <div className="flex items-center gap-space-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-secondary-container" />
            <span className={cx(t.h4, "text-primary")}>مَوْزُون | MAWZŪN</span>
            <span className={cx(t.code, "text-on-surface-variant")}>— مقياس أمانة النقل</span>
          </div>
          <Stepper activeId={activeId} unlockedIds={unlockedIds} />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-space-xl px-margin-desktop py-space-xl">
        <InputSection />

        {!revealed && (
          <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-space-xl">
            <div className="flex items-start gap-space-md">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xs bg-surface-container text-secondary">
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

      <footer className="w-full bg-surface-container-low py-space-md">
        <div
          className={cx(
            t.code,
            "w-full flex flex-col items-center justify-between gap-space-sm px-margin-desktop text-on-surface-variant md:flex-row",
          )}
        >
          <span>مَوْزُون: يقيس أمانة النقل، ولا يفتي ولا يرجّح مذهبًا</span>
          <div className="flex items-center gap-space-lg">
            <span>SHA-256</span>
            <span>المراجع البشري صاحب القرار</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
