/**
 * The retrieval layer's contract.
 *
 * Mawzun is not a question-answering system, so "retrieval" here does not mean
 * fetching context for a model to write prose from. It means reaching the
 * approved source for a specific claim the audit is making, so the finding
 * carries a citation instead of an assertion: the approved Quranic text for a
 * quotation, the approved rendering for a glossary term, the approved answer for
 * a da'wah question.
 *
 * Two rules shape every type below.
 *
 * 1. **Live, not stored.** The Quranpedia usage policy is explicit that its API
 *    is not a download service: the text is corrected weekly, so a copy scraped
 *    today silently drifts, and republishing a dump is both against the policy
 *    and a rights question. So a citation carries the URL it came from and the
 *    moment it was read, and no bulk copy of any approved source is committed.
 *
 * 2. **Retrieval never decides.** A citation is evidence attached to a finding.
 *    The verdict stays a function of the deterministic rule, so a network
 *    failure degrades the evidence and never flips a verdict. The one exception
 *    is deliberate and sealed: when layer 1 compares a Quranic quotation against
 *    the approved text, the passage it used is written into the record, so a
 *    replay compares against the sealed passage and not against a fresh fetch.
 */

export type SourceId =
  | "quranpedia"
  | "dawa"
  | "package"
  | "dorar"
  | "shamela"
  | "islamic-content";

export type SourceKind =
  /** A documented public API, queried live. */
  | "live-api"
  /** A public page fetched live on demand. */
  | "live-fetch"
  /** Material the challenge organiser supplied, held in the repository. */
  | "local-package"
  /** Declared, with a measured failure and the reason. */
  | "unreachable";

export type CitationKind = "quran" | "translation" | "glossary" | "faq" | "tafsir";

export interface Citation {
  /** Which approved source this came from. */
  readonly sourceId: SourceId;
  /** The source's Arabic label, as printed in the package. */
  readonly label: string;
  /** The exact address the passage was read from. */
  readonly url: string;
  /** When it was read, ISO-8601. Part of the evidence, not decoration. */
  readonly retrievedAt: string;
  /** SHA-256 of `passage`, so a reviewer can tell whether the source changed. */
  readonly hash: string;
  /** The quoted span itself, kept short and attributed. */
  readonly passage: string;
  readonly kind: CitationKind;
  /** Present for Quranic citations: the surah and ayah it belongs to. */
  readonly ayah?: { surah: number; ayah: number };
}

/** What a connector returns, including the honest failure case. */
export interface RetrievalOutcome {
  /** Empty when the source could not be reached — never a placeholder. */
  readonly citations: readonly Citation[];
  /**
   * Why there are none, in the operator's words, when there are none. This is
   * recorded as a coverage note so an empty citation list is never read as
   * "the source agreed".
   */
  readonly note?: string;
}

export interface SourceStatus {
  readonly id: SourceId;
  readonly label: string;
  /** The domain as printed in the package. */
  readonly address: string;
  /** The package's own usage rule for this source, quoted. */
  readonly rule: string;
  readonly kind: SourceKind;
  /** Measured from this environment, not assumed. */
  readonly httpStatus: number | null;
  /** Why it is in the state it is in. */
  readonly detail: string;
}
