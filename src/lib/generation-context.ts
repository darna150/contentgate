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
    ? "Apply the selected refinement to the CURRENT DRAFT COPY. The result must visibly change the relevant wording while preserving approved evidence and template fit."
    : "Create a fresh alternative version of the CURRENT DRAFT COPY. Preserve the same approved evidence, CTA intent, and campaign idea, but do not return identical or near-identical wording.";
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
