import { ArrowDown, Check } from "lucide-react";

/*
 * Coded micro-demo for the landing page's proof section: one generated line,
 * the approved source underneath, and the verbatim span highlighted across
 * both. Built in markup rather than shipped as an image — the Frontify
 * pattern — so it stays crisp, themeable, and readable to screen readers.
 *
 * Illustrative wording, NOT live output and not a screenshot of Studio.
 *
 * Kept honest against the real data model. `GeneratedFieldEvidence`
 * (src/lib/evidence-validation.ts) carries exactly `field`, `approved_source`,
 * `excerpt`, and `source_id` — there is NO document title, revision number,
 * approver, or date on a citation. Studio surfaces this as the "Source
 * support" list in studio-review-summary.tsx: one `Field: excerpt` row per
 * cited field.
 *
 * Approver and timestamp are real but live on the content revision, not the
 * citation, so they are shown below as a separate approval row rather than as
 * per-claim provenance. Do not merge the two back together — an earlier draft
 * of this component did, and it depicted a record the product does not keep.
 */

const GENERATED = {
  before: "Formulated for daily use in adult animals, and ",
  cited: "cleared for use alongside routine vaccination",
  after: ".",
};

const SOURCE = {
  before: "Section 4.2 — Concomitant use. The product is ",
  cited: "cleared for use alongside routine vaccination",
  after: " where the interval exceeds seven days.",
};

export function CitationProof() {
  return (
    <div className="overflow-hidden rounded-card border border-white/10 bg-white/[0.03]">
      <div className="flex flex-col gap-5 p-6 sm:p-8">
        {/* Generated copy */}
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Citations are per-field — this is what `citation.field` holds. */}
            <span className="text-label text-sidebar-text">
              Generated copy · Headline
            </span>
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-caption text-sidebar-text">
              Draft
            </span>
          </div>
          <p className="text-subhead text-pretty text-white">
            {GENERATED.before}
            <mark
              data-reveal
              className="sweep rounded bg-transparent px-1 py-0.5 text-white"
            >
              {GENERATED.cited}
            </mark>
            {GENERATED.after}
          </p>
        </div>

        {/* Connector */}
        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-white/10" />
          <span className="flex items-center gap-1.5 rounded-full border border-brand-on-dark/40 bg-brand-on-dark/10 px-2.5 py-1 text-caption font-semibold text-brand-on-dark">
            <ArrowDown className="h-3 w-3" />
            matched word for word
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Approved source */}
        <div className="flex flex-col gap-2.5 rounded-card border border-white/10 bg-brand-dark/60 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label text-sidebar-text">
              Approved source
            </span>
            <span className="flex items-center gap-1 rounded-full border border-brand-on-dark/40 bg-brand-on-dark/10 px-2 py-0.5 text-caption font-semibold text-brand-on-dark">
              <Check className="h-3 w-3" />
              Approved
            </span>
          </div>
          <p className="text-prose text-pretty text-sidebar-text">
            {SOURCE.before}
            <mark
              data-reveal
              className="sweep rounded bg-transparent px-1 py-0.5 text-white"
            >
              {SOURCE.cited}
            </mark>
            {SOURCE.after}
          </p>
        </div>
      </div>

      {/* Where the excerpt is re-checked. These four points are the §4 safe
          wording, not decoration — the same span is revalidated at each. */}
      <dl className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/[0.06] sm:grid-cols-4">
        {[
          { k: "Re-checked at", v: "Submit" },
          { k: "And at", v: "Approve" },
          { k: "And at", v: "Export" },
          { k: "And at", v: "Render" },
        ].map((item) => (
          <div
            key={item.v}
            className="flex flex-col gap-1 bg-brand-dark px-5 py-4"
          >
            <dt className="text-label text-sidebar-text">{item.k}</dt>
            <dd className="text-caption font-semibold text-white">{item.v}</dd>
          </div>
        ))}
      </dl>

      {/* Approval is real but lives on the content revision, not the citation.
          Kept visually separate for exactly that reason. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-4 sm:px-8">
        <p className="text-caption text-sidebar-text">
          The asset itself is released separately, by a named person against one
          exact revision.
        </p>
        <p className="text-caption text-sidebar-text">
          Illustration, not live output.
        </p>
      </div>
    </div>
  );
}
