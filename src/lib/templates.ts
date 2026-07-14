// Field metadata + revision controls shared by generation, review, and render.

export const FIELD_LABELS: Record<string, string> = {
  // Legacy layout fields
  headline: "Headline",
  subheadline: "Subheadline",
  body: "Body copy",
  key_takeaway: "Key takeaway",
  benefit_1: "Benefit 1",
  benefit_2: "Benefit 2",
  benefit_3: "Benefit 3",
  cta: "Call to action",
  contact: "Contact",
  local_detail: "Local detail",
  proof_note: "Proof note",
  territory: "Territory",
  kicker: "Kicker / eyebrow",
  benefits: "Benefits",
  subline: "Subline",
  supportCopy: "Support copy",
};

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, " ");
}

// Controlled revision options. NOT a freeform prompt box.
export const REVISION_OPTIONS: { key: string; label: string; instruction: string }[] = [
  { key: "shorter", label: "Shorter", instruction: "Make the copy noticeably shorter and tighter." },
  { key: "longer", label: "Longer", instruction: "Expand the copy with a little more supporting detail (still only from approved sources)." },
  { key: "strategic", label: "More strategic", instruction: "Frame the copy for brand leaders and decision-makers while staying grounded in approved sources." },
  { key: "educational", label: "More educational", instruction: "Make it more educational and awareness-focused, less promotional." },
  { key: "professional", label: "More professional", instruction: "Make the tone more formal and professional." },
  { key: "conversational", label: "More conversational", instruction: "Make the tone warmer and more conversational." },
  { key: "local_team", label: "More local-team focused", instruction: "Frame the message for branch, franchise, dealer, or field teams that need easy localized content." },
  { key: "brand_control", label: "More brand-control focused", instruction: "Lead with brand governance, locked templates, approvals, and consistency across markets." },
  { key: "benefit", label: "More benefit-focused", instruction: "Lead harder with the customer benefit, grounded in approved claims." },
];

export function revisionInstruction(key: string): string | null {
  return REVISION_OPTIONS.find((o) => o.key === key)?.instruction ?? null;
}

// Flatten structured fields into plain text (for .md export and previews).
export function flattenFields(
  fields: Record<string, string>,
  order: string[]
): string {
  return order
    .map((k) => fields[k]?.trim())
    .filter(Boolean)
    .join("\n\n");
}

export type Evidence = { field: string; approved_source: string };
