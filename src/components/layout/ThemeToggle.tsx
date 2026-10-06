"use client";

/**
 * Dark / light control for the shared header.
 *
 * The DOM is the source of truth: the pre-paint script in `layout.tsx` resolves
 * the theme from `localStorage.mawzun_theme` (OS preference only when nothing is
 * stored, light otherwise) and stamps it on <html>. This control reads that
 * attribute through `useSyncExternalStore` — the server snapshot is light, the
 * live snapshot is the attribute — so hydration matches the server markup and
 * the button follows the attribute wherever it changes, without a
 * setState-in-effect cascade.
 */

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";

export const THEME_KEY = "mawzun_theme";

type Theme = "light" | "dark";

function subscribe(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "التبديل إلى السمة الفاتحة" : "التبديل إلى السمة الداكنة"}
      aria-pressed={isDark}
      onClick={() => {
        const target: Theme = getSnapshot() === "dark" ? "light" : "dark";
        try {
          window.localStorage.setItem(THEME_KEY, target);
        } catch {
          // Storage being unavailable costs only persistence, not the switch.
        }
        const root = document.documentElement;
        root.setAttribute("data-theme", target);
        root.style.colorScheme = target;
      }}
      className={cx(
        "flex h-9 w-9 items-center justify-center rounded border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface",
      )}
    >
      <Icon name={isDark ? "light_mode" : "dark_mode"} className="text-lg" />
    </button>
  );
}
