/**
 * Domain types for the Mawzun fidelity-audit engine.
 *
 * The engine measures the fidelity of transmission between a source Sharia
 * text and a derived text (translation / summary / paraphrase). It never
 * issues a fatwa, never favours a madhhab and never rules on the soundness of
 * an opinion — see docs/workflow/fidelity-audit.md.
 */

import type { Citation } from "./rag-types";

/** What kind of derivation produced the derived text. */
export type WorkType = "translate" | "summarize" | "paraphrase";

/** Content level declared by the operator, per the challenge reference package. */
export type ContentLevel = "A" | "B" | "C" | "D";

/** The six families of constraints imported from the scientific package. */
export type ConstraintKind = "term" | "ruling" | "condition" | "restriction" | "isnad" | "number";

/** Which check layer produced a finding. */
export type LayerId = "L1" | "L2" | "L3";

/** Classification of a single finding — the only three states allowed. */
export type FindingClass = "preserved" | "shifted" | "missing";

/** The single verdict, with exactly three states. */
export type VerdictState = "faithful" | "needs_revision" | "refer";

/**
 * A constraint as imported from the approved scientific package.
 * `origin` must point at the passage of the package it came from, so every
 * constraint is traceable to a source rather than to the system's opinion.
 */
export interface Constraint {
  readonly id: string;
  readonly kind: ConstraintKind;
  /** The Arabic surface form(s) in the source text that this constraint guards. */
  readonly source: readonly string[];
  /** The declared rule, in Arabic, as stated in the scientific package. */
  readonly rule: string;
  /** Approved renderings in the derived language, keyed by language code. */
  readonly approved: Record<string, string[]>;
  /** Renderings that the package rules out, keyed by language code. */
  readonly forbidden: Record<string, string[]>;
  /** Where in the scientific package this constraint is stated. */
  readonly origin: string;
}

/** Machine-readable reference to a constraint bank. */
export interface ConstraintBank {
  readonly version: string;
  /** The package the constraints were imported from. */
  readonly packageName: string;
  readonly constraints: readonly Constraint[];
}

/**
 * One finding: what was checked, where it sits in the derived text, and the
 * evidence for the classification. Reason + location + evidence are mandatory
 * on every finding — a finding missing any of the three is a defect.
 */
export interface Finding {
  readonly layer: LayerId;
  readonly constraintId: string | null;
  readonly kind: ConstraintKind | "quote" | "reference";
  readonly cls: FindingClass;
  /** Start offset in the derived text (code units). */
  readonly start: number;
  /** End offset in the derived text (code units, exclusive). */
  readonly end: number;
  /** The exact substring of the derived text the finding is about. */
  readonly span: string;
  readonly evidence: {
    /** What the source said. */
    readonly source: string;
    /** What the derived text says at this span. */
    readonly derived: string;
    /** Why the classifier reached this classification. */
    readonly note: string;
  };
  /**
   * Where this finding's claim can be checked against an approved source.
   *
   * Empty when no source could be reached, and the run's coverage notes say why:
   * an empty list is evidence that nothing was consulted, never agreement. The
   * passages are read live and attributed rather than stored, per the sources'
   * own policies — see `rag.ts`.
   */
  readonly citations?: readonly Citation[];
}

/**
 * A declared gap: something the engine did not check, and why. Reported
 * alongside findings so a reader never mistakes "no finding" for "verified".
 */
export interface CoverageNote {
  readonly layer: LayerId;
  readonly kind: ConstraintKind | "quote" | "reference";
  readonly reason: string;
}

/** The outcome of a full audit run. */
export interface AuditResult {
  readonly verdict: VerdictState;
  /** One-sentence reason for the verdict. */
  readonly reason: string;
  readonly findings: readonly Finding[];
  /** Per-layer counts, so the UI can show which layer produced what. */
  readonly layerSummary: Readonly<Record<LayerId, { checked: number; shifted: number; missing: number }>>;
  /** What this run did not check, stated plainly. */
  readonly coverage: readonly CoverageNote[];
}

/** Input to a full audit run. */
export interface AuditInput {
  readonly sourceText: string;
  readonly derivedText: string;
  readonly workType: WorkType;
  readonly contentLevel: ContentLevel;
  readonly targetLanguage: string;
  readonly bank: ConstraintBank;
  /** The human reviewer's decision, if one has been recorded. */
  readonly reviewerDecision?: string | null;
}
