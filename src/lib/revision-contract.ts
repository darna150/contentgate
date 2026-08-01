import { graphemeCount } from "./graphemes.ts";

function normalizedLength(value: string | undefined) {
  return graphemeCount(String(value ?? "").replace(/\s+/g, " ").trim());
}

function normalizedValue(value: string | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string | undefined) {
  return normalizedValue(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function tokenOverlapRatio(previous: string[], generated: string[]) {
  if (previous.length === 0) return 0;
  const generatedCounts = new Map<string, number>();
  for (const token of generated) {
    generatedCounts.set(token, (generatedCounts.get(token) ?? 0) + 1);
  }
  let overlap = 0;
  for (const token of previous) {
    const available = generatedCounts.get(token) ?? 0;
    if (available <= 0) continue;
    overlap += 1;
    generatedCounts.set(token, available - 1);
  }
  return overlap / Math.max(previous.length, generated.length, 1);
}

export function meaningfulVariationIssues(input: {
  editableFields: string[];
  generatedFields: Record<string, string>;
  previousFields: Record<string, string>;
}) {
  const comparableFields = input.editableFields.filter(
    (key) => normalizedLength(input.previousFields[key]) > 0
  );
  if (comparableFields.length === 0) return [];

  const changedFields = comparableFields.filter(
    (key) =>
      normalizedValue(input.generatedFields[key]) !==
      normalizedValue(input.previousFields[key])
  );
  const minimumChangedFields = comparableFields.length >= 3 ? 2 : 1;
  const previousTokens = comparableFields.flatMap((key) => tokens(input.previousFields[key]));
  const generatedTokens = comparableFields.flatMap((key) => tokens(input.generatedFields[key]));
  const overlap = tokenOverlapRatio(previousTokens, generatedTokens);
  const issues: string[] = [];

  if (changedFields.length < minimumChangedFields) {
    issues.push(
      `change at least ${minimumChangedFields} of ${comparableFields.length} existing copy fields; only ${changedFields.length} changed`
    );
  }
  if (overlap >= 0.8) {
    issues.push(
      `rewrite the copy more substantially; ${Math.round(overlap * 100)}% of the wording still overlaps the current copy`
    );
  }
  return issues;
}

const SEMANTIC_REVISION_CRITERIA: Record<string, string> = {
  strategic:
    "The rewrite must make a visibly more strategic positioning choice for brand leaders or decision-makers, not merely swap synonyms.",
  playful:
    "The rewrite must feel noticeably lighter and more playful than the prior copy while remaining credible and grounded.",
  urgent:
    "The rewrite must create a noticeably stronger sense of immediacy or action than the prior copy without inventing scarcity or deadlines.",
  simpler:
    "The rewrite must be easier to understand at a glance through simpler vocabulary or sentence structure; it must not merely be different.",
  brand_voice:
    "The rewrite must align more closely with the approved brand voice and context than the prior copy, with a visible tone improvement rather than cosmetic word changes.",
  proof_point:
    "The rewrite must add or clearly foreground at least one concrete, approved, evidence-backed proof point that was absent or less prominent before.",
  benefit:
    "The rewrite must lead with a customer outcome or benefit more clearly than the prior copy instead of leading with a product fact or feature.",
};

export function semanticRevisionCriterion(revision: string | undefined) {
  return revision ? SEMANTIC_REVISION_CRITERIA[revision] ?? null : null;
}

export function revisionContractKind(revision: string | undefined) {
  if (revision === "shorter" || revision === "longer") return "length" as const;
  if (semanticRevisionCriterion(revision)) return "semantic" as const;
  return "none" as const;
}

export function revisionLengthIssues(input: {
  revision: string | undefined;
  editableFields: string[];
  generatedFields: Record<string, string>;
  previousFields: Record<string, string>;
}) {
  if (input.revision !== "shorter" && input.revision !== "longer") return [];

  return input.editableFields.flatMap((key) => {
    const previousLength = normalizedLength(input.previousFields[key]);
    const generatedLength = normalizedLength(input.generatedFields[key]);
    if (previousLength === 0) {
      return input.revision === "shorter" && generatedLength > 0
        ? [`${key}: must remain empty when making the current copy shorter`]
        : [];
    }
    const satisfiesDirection =
      input.revision === "shorter"
        ? generatedLength < previousLength
        : generatedLength > previousLength;
    if (satisfiesDirection) return [];

    return [
      `${key}: must be ${input.revision} than the current ${previousLength}-character copy (received ${generatedLength} characters)`,
    ];
  });
}

export function revisionAvailabilityIssue(input: {
  revision: string;
  editableFields: readonly string[];
  currentFields: Record<string, string>;
  requiredFields: readonly string[];
  fieldLimits: Record<string, { max_chars?: number } | undefined>;
}) {
  if (input.revision === "longer") {
    const blocked = input.editableFields.find((key) => {
      const currentLength = normalizedLength(input.currentFields[key]);
      const maxChars = input.fieldLimits[key]?.max_chars;
      return currentLength > 0 && maxChars !== undefined && currentLength >= maxChars;
    });
    return blocked
      ? `${blocked.replace(/_/g, " ")} is already at its maximum length for this format.`
      : null;
  }
  if (input.revision === "shorter") {
    const required = new Set(input.requiredFields);
    const blocked = input.editableFields.find(
      (key) => required.has(key) && normalizedLength(input.currentFields[key]) <= 1
    );
    return blocked
      ? `${blocked.replace(/_/g, " ")} cannot be shortened further in this format.`
      : null;
  }
  return null;
}
