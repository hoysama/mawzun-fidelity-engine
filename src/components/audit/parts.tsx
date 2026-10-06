"use client";

/**
 * Shared primitives for the audit workspace.
 *
 * The design language this file encodes is the product's moss system — the same
 * one the welcome route paints with (`src/components/landing/*`):
 * - the brand accent is moss-600, its text steps are moss-700/800, and controls
 *   (buttons, chips, the stepper) are fully rounded pills;
 * - depth stays tonal: flat panels carry a 1px hairline border plus the very
 *   light `shadow-sm` the design puts on every card;
 * - colour is reserved for state (verified / needs revision / stop & escalate),
 *   not decoration — the three states keep three distinct hues;
 * - telemetry (ids, hashes, layer codes) is always monospaced;
 * - figures are tabular, because every screen here is a ledger.
 */

import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";
import { Icon } from "@/components/ui/Icon";
import { STAGES } from "@/lib/stages";
import type { Finding } from "@/lib/audit/types";
import type { Citation } from "@/lib/audit/rag-types";

/** A numbered workflow section: the unit the whole design is built from. */
export function WorkflowCard({
  number,
  title,
  subtitle,
  aside,
  id,
  children,
}: {
  number: number;
  title: string;
  subtitle: string;
  aside?: ReactNode;
  id: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-xl border border-outline-variant bg-surface-container-lowest p-space-xl shadow-sm flex flex-col gap-space-lg"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm pb-space-md">
        <div className="flex items-center gap-space-md">
          <div
            className={cx(
              t.codeMd,
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-moss-600 text-on-primary",
            )}
          >
            {number}
          </div>
          <div className="flex flex-col">
            <h2 className={cx(t.h2, "text-on-surface")}>{title}</h2>
            <p className={cx(t.bodySm, "text-on-surface-variant")}>{subtitle}</p>
          </div>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Telemetry chip: monospaced and tonally filled (the reference draws no rule). */
export function CodeChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        t.code,
        "inline-flex items-center gap-space-xs rounded-pill bg-surface-container px-space-sm py-0.5 text-on-surface-variant",
        className,
      )}
    >
      {children}
    </span>
  );
}

export type SemanticTone = "verified" | "revision" | "escalate" | "neutral";

const TONE: Record<SemanticTone, string> = {
  // Verified / matched — the brand moss, the hue the landing's accents carry.
  verified: "bg-moss-100 text-moss-800",
  // Needs revision / inconclusive — stays blue, so it reads as neither the moss
  // of a faithful run nor the red of an escalation.
  revision: "bg-secondary-fixed text-on-secondary-fixed-variant",
  // Stop & escalate — stays red.
  escalate: "bg-error-container text-on-error-container",
  neutral: "bg-surface-container text-on-surface-variant",
};

export function StatusChip({
  tone = "neutral",
  children,
  icon,
  className,
}: {
  tone?: SemanticTone;
  children: ReactNode;
  icon?: string;
  className?: string;
}) {
  return (
    <span
      className={cx(
        t.labelSm,
        "inline-flex items-center gap-space-xs rounded-pill px-space-sm py-0.5 font-medium",
        TONE[tone],
        className,
      )}
    >
      {icon && <Icon name={icon} className="text-[14px]" />}
      {children}
    </span>
  );
}

/** A labelled value row used across the verdict, certificate and pipeline. */
export function KeyValue({
  label,
  value,
  mono = false,
  tone,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  tone?: SemanticTone;
}) {
  return (
    <div className="flex items-start justify-between gap-space-md py-1">
      <span className={cx(t.bodySm, "shrink-0 text-on-surface-variant")}>{label}</span>
      <span
        className={cx(
          mono ? t.code : t.bodySm,
          "text-right",
          tone === "escalate" ? "text-error" : tone === "revision" ? "text-secondary" : "text-on-surface",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export const FINDING_TONE: Record<Finding["cls"], SemanticTone> = {
  preserved: "verified",
  shifted: "escalate",
  missing: "revision",
};

export const FINDING_LABEL: Record<Finding["cls"], string> = {
  preserved: "محفوظ",
  shifted: "منزاح",
  missing: "مفقود",
};

/**
 * The stepper: numbered pills joined by direction arrows.
 *
 * A stage that has not been reached yet is not a link — the later sections do
 * not exist in the DOM until the audit has run, so offering them as navigation
 * would promise targets that are not there. Locked stages render as plain
 * labels, dimmed, with no href.
 */
export function Stepper({ activeId, unlockedIds }: { activeId: string; unlockedIds: readonly string[] }) {
  return (
    <nav aria-label="مراحل سير العمل" className="flex items-center overflow-x-auto gap-space-xs py-1">
      {STAGES.map((stage, index) => {
        const isActive = stage.id === activeId;
        const isDone = index < STAGES.findIndex((s) => s.id === activeId);
        const isUnlocked = unlockedIds.includes(stage.id);

        if (!isUnlocked) {
          return (
            <span key={stage.id} className="flex items-center gap-space-xs">
              {index > 0 && (
                <span aria-hidden="true" className={cx(t.code, "select-none text-outline-variant/60")}>
                  ←
                </span>
              )}
              <span
                aria-disabled="true"
                title="يظهر هذا القسم بعد تنفيذ الفحص"
                className={cx(
                  "flex items-center gap-space-xs rounded-pill px-space-md py-1.5 whitespace-nowrap opacity-45",
                  "bg-surface-container text-on-surface-variant",
                )}
              >
                <span className={cx(t.code, "text-on-surface-variant")}>{stage.ordinal}</span>
                <span className={cx(t.label, "whitespace-nowrap")}>{stage.title}</span>
              </span>
            </span>
          );
        }

        return (
          <span key={stage.id} className="flex items-center gap-space-xs">
            {index > 0 && (
              <span aria-hidden="true" className={cx(t.code, "select-none text-outline-variant")}>
                ←
              </span>
            )}
            <a
              href={`#${stage.id}`}
              aria-current={isActive ? "true" : undefined}
              className={cx(
                "flex items-center gap-space-xs rounded-pill px-space-md py-1.5 transition-colors whitespace-nowrap",
                isActive
                  ? "bg-moss-600 text-on-primary"
                  : isDone
                    ? "bg-moss-100 text-moss-700 hover:bg-moss-200"
                    : "bg-surface-container text-on-surface hover:bg-surface-container-high",
              )}
            >
              <span className={cx(t.code, isActive ? "opacity-80" : "text-on-surface-variant")}>
                {stage.ordinal}
              </span>
              <span className={cx(t.label, "whitespace-nowrap")}>{stage.title}</span>
            </a>
          </span>
        );
      })}
    </nav>
  );
}

/**
 * The derived text with every located finding highlighted.
 *
 * Overlapping findings are resolved by first-wins on start offset, because two
 * panes of the same span in two colours would tell the reader nothing.
 */
export function HighlightedText({ text, findings }: { text: string; findings: readonly Finding[] }) {
  const parts = (() => {
    const located = findings.filter((f) => f.end > f.start).sort((a, b) => a.start - b.start);
    const out: ReactNode[] = [];
    let cursor = 0;

    for (const f of located) {
      if (f.start < cursor) continue;
      out.push(text.slice(cursor, f.start));
      out.push(
        <mark
          key={`${f.start}-${f.end}`}
          className={cx(
            "rounded-xs border-b",
            f.cls === "shifted"
              ? "bg-error-container/60 border-error text-on-surface"
              : "bg-moss-100 border-moss-200 text-on-surface",
          )}
        >
          {text.slice(f.start, f.end)}
        </mark>,
      );
      cursor = f.end;
    }
    out.push(text.slice(cursor));
    return out;
  })();

  return (
    <p dir="auto" className={cx(t.bodyLg, "leading-relaxed text-on-surface")}>
      {parts}
    </p>
  );
}

/** A recessed panel: the design's "inset verification trace". */
export function InsetPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "rounded-lg border border-outline-variant bg-surface-container-low p-space-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The citations attached to one finding: where its claim can actually be read.
 *
 * Every field is taken from the citation the retrieval layer produced — the
 * source's own Arabic label, the quoted passage, the address it was read from
 * and the moment it was read. Nothing here is composed by the interface, and a
 * finding that carries no citation renders nothing at all: an empty frame
 * reads as evidence that was sought and left blank, when the run's coverage
 * notes are what say a check could not run.
 */
export function CitationList({
  citations,
  title = "حيث يمكن التحقق",
}: {
  citations: readonly Citation[];
  title?: string;
}) {
  if (citations.length === 0) return null;

  return (
    <div className="flex flex-col gap-space-xs">
      <span className={cx(t.code, "text-on-surface-variant")}>{title}</span>
      <ul className="flex flex-col gap-space-xs">
        {citations.map((citation, index) => (
          <li
            key={index}
            className="rounded-lg border border-outline-variant bg-surface-container-low p-space-sm"
          >
            <div className="flex flex-wrap items-center gap-space-xs">
              <span className={cx(t.labelSm, "font-semibold text-on-surface")}>{citation.label}</span>
              <span className={cx(t.code, "text-on-surface-variant")}>{citation.kind}</span>
              {citation.ayah && (
                <span dir="ltr" className={cx(t.code, "text-on-surface-variant")}>
                  {citation.ayah.surah}:{citation.ayah.ayah}
                </span>
              )}
            </div>
            <blockquote dir="auto" className={cx(t.bodySm, "mt-space-xs text-on-surface")}>
              «{citation.passage}»
            </blockquote>
            <div className="mt-space-xs flex flex-wrap items-baseline gap-x-space-sm gap-y-1 text-on-surface-variant">
              <CitationAddress url={citation.url} />
              <span className={t.bodySm}>قُرئ في</span>
              <span dir="ltr" className={t.code}>
                {citation.retrievedAt}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The address a passage was read from, as a link only when it is one.
 *
 * A network citation carries the exact endpoint it came from, so it is a link
 * the reviewer can open and check. A locally held document has no address a
 * browser can reach, so its file name is shown as telemetry rather than as a
 * link that would 404 — a broken link is a false claim, not a courtesy.
 */
function CitationAddress({ url }: { url: string }) {
  if (/^https?:\/\//i.test(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={cx(t.code, "break-all text-moss-700 underline underline-offset-2")}
      >
        {url}
      </a>
    );
  }
  return <span className={cx(t.code, "break-all")}>{url}</span>;
}
