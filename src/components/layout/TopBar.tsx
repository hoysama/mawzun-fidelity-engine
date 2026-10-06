"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { t } from "@/lib/typography";
import { SearchModal } from "@/components/layout/SearchModal";
import { SettingsModal } from "@/components/layout/SettingsModal";

/**
 * Global header.
 *
 * The brand block, the search entry and the two controls it actually operates.
 * The workflow stepper is not here: the five stages are sections of the
 * workspace, and the workspace's own session bar carries the stepper beside the
 * content it indexes. Duplicating it into the chrome gave every route a
 * navigation whose targets only exist on one of them.
 */
export function TopBar() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Global keyboard shortcut for search: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <header className="fixed top-0 right-0 left-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant bg-surface/95 px-margin-desktop backdrop-blur-xl">
        <div className="flex items-baseline gap-space-sm">
          <span className={cx(t.h4, "tracking-tight text-moss-700")}>مَوْزُون</span>
          <span className={cx(t.code, "font-normal text-on-surface-variant")}>(مقياس أمانة النقل)</span>
        </div>

        <div className="flex items-center gap-space-sm">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label="البحث في القيود والمراحل"
            className={cx(
              t.bodySm,
              "hidden items-center gap-space-xs rounded-pill border border-moss-200 bg-surface-container-low px-space-sm py-1.5 text-on-surface-variant transition-colors hover:bg-moss-100 sm:flex",
            )}
          >
            <Icon name="search" className="text-base text-outline" />
            <span className="text-outline">بحث في القيود...</span>
            <kbd className={cx(t.code, "rounded-sm bg-surface-container-lowest px-1 text-outline")}>
              ⌘K
            </kbd>
          </button>

          <ThemeToggle />

          <button
            type="button"
            aria-label="الإعدادات"
            onClick={() => setIsSettingsOpen((prev) => !prev)}
            className={cx(
              "flex h-9 w-9 items-center justify-center rounded-pill border transition-colors",
              isSettingsOpen
                ? "border-moss-600 bg-moss-600 text-on-primary"
                : "border-outline-variant text-on-surface-variant hover:bg-surface-container-high",
            )}
          >
            <Icon name="tune" className="text-lg" />
          </button>
        </div>
      </header>

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
