/**
 * Typography roles from DESIGN.md, expressed as the Tailwind class pair that
 * applies both the family and the size/leading/tracking scale.
 *
 * Kept as a map rather than scattered across components so the type ramp stays
 * consistent and the font/size pairing lives in one place. Weights cap out at
 * 600 — the design forbids heavy display weights.
 */
export const t = {
  /** Page-level statement. */
  display: "font-display-lg text-display-lg",
  /** Large single-statement display step (46px), part of the type ramp. */
  hero: "font-hero text-hero",
  /** Large numeric-figure step (34px), part of the type ramp. */
  stat: "font-stat text-stat",
  /** The design's smaller display step (30px) — the workspace masthead. */
  heroSm: "font-hero text-hero-sm",
  /** Section titles inside a workflow card. */
  h2: "font-headline-lg text-headline-lg",
  /** Card and sub-section titles. */
  h3: "font-headline-md text-headline-md",
  /** Compact titles. */
  h4: "font-headline-sm text-headline-sm",
  /** Lead paragraphs. */
  bodyLg: "font-body-lg text-body-lg",
  /** Default body copy. */
  body: "font-body-md text-body-md",
  /** Metadata, captions, helper lines. */
  bodySm: "font-body-sm text-body-sm",
  /** Field labels and controls. */
  label: "font-label-lg text-label-lg",
  /** Dense labels, table headers, chips. */
  labelSm: "font-label-md text-label-md",
  /** Telemetry at body size: ids, codes, hashes. */
  codeMd: "font-code-md text-code-md",
  /** Telemetry at the smallest size: badges, gutter markers. */
  code: "font-code-sm text-code-sm",
} as const;

