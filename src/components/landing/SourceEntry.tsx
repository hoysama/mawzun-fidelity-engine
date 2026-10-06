"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";

/**
 * The source-text field and the button that hands it to the audit workspace.
 *
 * Deliberately not a <form>: there is nothing to preventDefault, and the
 * hand-off is storage plus navigation rather than a submit. The audit store is
 * mounted in the root layout, so a client-router push to `/` would keep the
 * already-initialised provider and never read the pending text; the navigation
 * is therefore a full document load, which re-runs the provider so it can
 * consume `mawzun_pending_source` once during initialisation.
 */

export const PENDING_SOURCE_KEY = "mawzun_pending_source";

export function SourceEntry() {
  const [text, setText] = useState("");

  const handOff = () => {
    // Store exactly what was typed. A blank value is not stored at all, so the
    // workspace opens with an empty field just as a direct visit does.
    try {
      if (text.trim().length > 0) {
        window.sessionStorage.setItem(PENDING_SOURCE_KEY, text);
      }
    } catch {
      // No session storage (private mode, sandbox): still navigate.
    }
    // A full document navigation is required here, not a router push: the audit
    // store lives in the root layout, and a client-side transition would keep
    // the already-initialised provider, which would never read the pending key.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  };

  return (
    <div className="flex flex-col gap-space-md rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
      <label htmlFor="welcome-source" className={cx(t.label, "font-semibold text-on-surface")}>
        النص الأصلي — القرآن أو الحديث أو أي نصٍّ يُراد فحصه
      </label>
      <textarea
        id="welcome-source"
        dir="rtl"
        rows={6}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="الصق النص الأصلي هنا…"
        className={cx(
          t.body,
          "w-full resize-y rounded-lg border border-outline-variant bg-surface-container-low p-space-md leading-relaxed text-on-surface transition-colors focus:border-secondary focus:bg-surface-container-lowest focus:outline-none",
        )}
      />
      <button
        type="button"
        onClick={handOff}
        className={cx(
          t.label,
          "inline-flex items-center justify-center gap-space-xs rounded-xs bg-primary px-space-md py-2 font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary-container",
        )}
      >
        <Icon name="play_arrow" className="text-base" />
        افحص النص
      </button>
    </div>
  );
}
