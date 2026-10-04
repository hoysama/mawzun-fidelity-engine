/**
 * Shared context passed to each check layer.
 *
 * Kept in its own module so the three layers and the semantic provider can
 * import it without importing each other.
 *
 * The `retriever` is the one network boundary the deterministic layers may
 * cross. It is injected exactly like the semantic provider: the live
 * connectors are the default in production, and a test passes a deterministic
 * fake so no check ever needs the internet. `now` is threaded through so a
 * citation written into the record is reproducible when the run fixes a
 * timestamp — the citation's `retrievedAt` is evidence, so it must not float.
 */

import type { ConstraintBank, ContentLevel, CoverageNote, Finding } from "./types";
import type { Citation, RetrievalOutcome } from "./rag-types";

/** A located Quranic passage: where it is, and the approved text itself. */
export interface AyahRef {
  readonly surah: number;
  readonly ayah: number;
}

/**
 * The outcome of trying to locate one quotation in the approved mushaf.
 *
 * The three cases are distinct on purpose, because they are said differently
 * to the operator: `located` yields a finding, `unlocated` means the quotation
 * could not be tied to an ayah (not that it is wrong), and `unavailable` means
 * the source could not be reached at all — a gap, not a negative result.
 */
export type QuoteLookup =
  | {
      readonly status: "located";
      readonly ayah: AyahRef;
      /** The approved passage used for the comparison, verbatim from the connector. */
      readonly approved: string;
      /** The citation that travels with the finding and into the sealed record. */
      readonly citation: Citation;
    }
  | { readonly status: "unlocated" }
  | { readonly status: "unavailable"; readonly note: string };

/**
 * The retrieval a layer is allowed to do. Implemented by the live connectors in
 * production and by a fake in the checks; nothing else may reach the network.
 */
export interface Retriever {
  readonly id: string;
  /** Locate a quotation and return the approved passage it will be compared to. */
  lookupQuote(quote: string): Promise<QuoteLookup>;
  /** The citation rows for a span that looks Quranic (layer 3's use). */
  citeSpan(span: string): Promise<RetrievalOutcome>;
}

export interface LayerContext {
  readonly source: string;
  readonly derived: string;
  readonly language: string;
  readonly level: ContentLevel;
  readonly bank: ConstraintBank;
  /** The run timestamp, so a citation's `retrievedAt` is reproducible. */
  readonly now?: string;
  /** Absent when retrieval is disabled; then layer 1 declares that gap. */
  readonly retriever?: Retriever;
}

export interface LayerOutput {
  readonly findings: readonly Finding[];
  readonly coverage: readonly CoverageNote[];
  /** How many checks this layer actually attempted. */
  readonly checked: number;
}
