import { fieldLabel } from "@/lib/templates";

import type { StudioContent } from "./studio-data";

function changedFields(current: StudioContent, previous: StudioContent | null) {
  if (!previous) return Object.keys(current.structured_fields);
  const keys = new Set([
    ...Object.keys(previous.structured_fields),
    ...Object.keys(current.structured_fields),
  ]);
  return Array.from(keys).filter(
    (key) =>
      String(previous.structured_fields[key] ?? "") !==
      String(current.structured_fields[key] ?? "")
  );
}

export function StudioReviewSummary({
  content,
  previousVersion,
  hasFitIssues,
}: {
  content: StudioContent;
  previousVersion: StudioContent | null;
  hasFitIssues: boolean;
}) {
  const fields = changedFields(content, previousVersion);
  const evidenceByField = new Map<string, string[]>();
  for (const citation of content.citations) {
    const excerpt = citation.excerpt ?? citation.approved_source;
    if (!excerpt) continue;
    const entries = evidenceByField.get(citation.field) ?? [];
    if (!entries.includes(excerpt)) entries.push(excerpt);
    evidenceByField.set(citation.field, entries);
  }

  return (
    <section className="flex flex-col gap-2.5 rounded-card border border-edge bg-surface p-4" aria-labelledby="review-summary-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="review-summary-title" className="text-h2 text-ink">Review summary</h2>
        <span className="text-caption text-ink-faint">
          {previousVersion ? "Compared with prior version" : "First version"}
        </span>
      </div>
      <p className="text-[13px] leading-5 text-ink-muted">
        {previousVersion
          ? fields.length
            ? `${fields.length} field${fields.length === 1 ? "" : "s"} changed in this format.`
            : "No copy or visual-choice fields changed from the prior version."
          : "Review the initial copy and approved visual choices for this format."}
      </p>
      {fields.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Changed fields">
          {fields.map((field) => (
            <li key={field} className="rounded-[5px] bg-brand-tint px-2 py-1 text-[13px] font-semibold text-brand">
              {fieldLabel(field)}
            </li>
          ))}
        </ul>
      )}
      <p className={`rounded-control px-3 py-2 text-[13px] font-semibold ${hasFitIssues ? "bg-reject-tint text-reject" : "bg-approve-tint text-approve"}`}>
        {hasFitIssues
          ? "Fit needs correction before approval."
          : "Fit is clear. Approval rechecks source evidence and this exact revision."}
      </p>
      <div className="flex flex-col gap-1.5 border-t border-edge pt-2.5">
        <p className="text-[13px] font-semibold text-ink">Source support</p>
        {evidenceByField.size === 0 ? (
          <p className="text-[13px] leading-5 text-ink-muted">
            No field-level source excerpts were stored with this draft. Approval will block unsupported factual claims.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {Array.from(evidenceByField.entries()).map(([field, excerpts]) => (
              <li key={field} className="rounded-control bg-page px-3 py-2 text-[13px] leading-5 text-ink-muted">
                <span className="font-semibold text-ink">{fieldLabel(field)}: </span>
                {excerpts[0]}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
