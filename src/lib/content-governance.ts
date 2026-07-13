export type ContentRole = "admin" | "approver" | "member";
export type ContentStatus = "draft" | "in_review" | "approved" | "rejected";

export const CONTENT_EXPORT_FORMATS = [
  "md",
  "clipboard_text",
  "png",
  "jpeg",
  "pdf",
] as const;

export type ContentExportFormat = (typeof CONTENT_EXPORT_FORMATS)[number];

export function isContentExportFormat(
  value: unknown
): value is ContentExportFormat {
  return (
    typeof value === "string" &&
    CONTENT_EXPORT_FORMATS.includes(value as ContentExportFormat)
  );
}

export function canReviewContent(role: ContentRole): boolean {
  return role === "admin" || role === "approver";
}

export function canSubmitContent(input: {
  role: ContentRole;
  userId: string;
  authorId: string;
  status: ContentStatus;
}): boolean {
  return (
    (input.status === "draft" || input.status === "rejected") &&
    (input.userId === input.authorId || input.role === "admin")
  );
}

export function canEditContent(input: {
  userId: string;
  authorId: string;
  status: ContentStatus;
}): boolean {
  return (
    input.userId === input.authorId &&
    (input.status === "draft" ||
      input.status === "rejected" ||
      input.status === "approved")
  );
}

export function canExportContent(input: {
  status: ContentStatus;
  currentRevision: number;
  approvedRevision: number | null;
}): boolean {
  return (
    input.status === "approved" &&
    input.approvedRevision !== null &&
    input.approvedRevision === input.currentRevision
  );
}
