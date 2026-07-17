type GenerationSourceRow = {
  prompt_context: Record<string, unknown> | null;
  structured_fields: Record<string, string> | null;
};

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, String(child ?? "")])
  );
}

export function generationSourceFields(
  row: GenerationSourceRow | null,
  options: { preferCurrentDraft?: boolean } = {}
) {
  if (!row) return {};
  const structuredFields = asStringRecord(row.structured_fields);
  const generatedFields =
    row.prompt_context && typeof row.prompt_context === "object"
      ? asStringRecord(row.prompt_context.generated_fields)
      : {};
  const campaignFields =
    row.prompt_context && typeof row.prompt_context === "object"
      ? asStringRecord(row.prompt_context.campaign_source_fields)
      : {};

  if (options.preferCurrentDraft) {
    if (Object.keys(structuredFields).length) return structuredFields;
    if (Object.keys(generatedFields).length) return generatedFields;
    return campaignFields;
  }

  if (Object.keys(campaignFields).length) return campaignFields;
  return Object.keys(generatedFields).length ? generatedFields : structuredFields;
}

export function regenerationInstruction(input: {
  replacingDraft: boolean;
  hasRevision: boolean;
}) {
  if (!input.replacingDraft) return "";
  return input.hasRevision
    ? "Apply the selected refinement to the CURRENT DRAFT COPY. Rewrite the headline/title field with a genuinely different lead angle and sentence structure, not a synonym swap or word-order tweak, while preserving approved evidence and template fit."
    : "Create a fresh alternative version of the CURRENT DRAFT COPY. Rewrite the headline/title field with a different lead angle, structure, and wording throughout, preserving the same approved evidence, CTA intent, and campaign idea, but do not return identical or near-identical wording. Reusing more than a few consecutive words from the previous headline counts as near-identical.";
}

function normalizedCopy(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function changedGeneratedFields(input: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  fieldOrder: readonly string[];
}) {
  return input.fieldOrder.some(
    (field) => normalizedCopy(input.before[field]) !== normalizedCopy(input.after[field])
  );
}

export function primaryTitleField(fieldOrder: readonly string[]) {
  return (
    fieldOrder.find((field) => field === "headline") ??
    fieldOrder.find((field) => /\b(headline|title|subject)\b/i.test(field)) ??
    null
  );
}

export function changedPrimaryTitleField(input: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  fieldOrder: readonly string[];
}) {
  const field = primaryTitleField(input.fieldOrder);
  if (!field) return true;
  return normalizedCopy(input.before[field]) !== normalizedCopy(input.after[field]);
}

function tokenize(value: unknown) {
  return normalizedCopy(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Catches "dramatic rewrite" requests that came back as a synonym swap or
// word-order shuffle: changedPrimaryTitleField already passed (some
// character differs) but most of the same words are still present.
export function primaryTitleFieldTooSimilar(input: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  fieldOrder: readonly string[];
  threshold?: number;
}) {
  const field = primaryTitleField(input.fieldOrder);
  if (!field) return false;
  const beforeTokens = tokenize(input.before[field]);
  const afterTokens = tokenize(input.after[field]);
  if (!beforeTokens.length || !afterTokens.length) return false;
  const beforeSet = new Set(beforeTokens);
  const afterSet = new Set(afterTokens);
  const shared = [...afterSet].filter((token) => beforeSet.has(token)).length;
  const union = new Set([...beforeSet, ...afterSet]).size;
  if (!union) return false;
  return shared / union >= (input.threshold ?? 0.6);
}
