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
  { key: "playful", label: "More playful", instruction: "Make the copy lighter and more playful without inventing facts or leaving the approved source material." },
  { key: "urgent", label: "More urgent", instruction: "Create a stronger sense of timeliness and action while staying grounded in approved sources." },
  { key: "simpler", label: "Simpler", instruction: "Simplify the language and make the message easier to understand at a glance." },
  { key: "brand_voice", label: "On-brand voice", instruction: "Tighten the copy so it feels more aligned with the approved brand voice and governance rules." },
  { key: "proof_point", label: "Add proof point", instruction: "Add or foreground one concrete proof point, but only if it is present in the approved source material." },
  { key: "benefit", label: "Lead with benefit", instruction: "Lead harder with the customer benefit, grounded in approved claims." },
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

// A grounding citation. `excerpt` is the verbatim quote the model pulled from
// an approved source (the verification key); `approved_source` is the fuller
// source text, kept for display and backward compatibility. `source_id` is the
// prompt-local id (e.g. "C2", "P4") the model referenced — useful for repair
// prompts but not stored, since ids are not stable across generations.
export type Evidence = {
  field: string;
  approved_source: string;
  excerpt?: string;
  source_id?: string;
};
