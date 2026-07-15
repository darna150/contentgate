// Studio has one surface and four modes, derived from content state rather
// than tracked separately — there is no "mode" the user sets directly.
export type StudioMode = "create" | "edit" | "review" | "read";

export function resolveStudioMode(input: {
  hasContent: boolean;
  status?: string;
  canEditContent: boolean;
  canReview: boolean;
}): StudioMode {
  if (!input.hasContent) return "create";
  if (input.status === "approved") return "read";
  if (input.status === "in_review") return input.canReview ? "review" : "read";
  // draft | rejected
  return input.canEditContent ? "edit" : "read";
}
