export type DocumentIndexStatus = "processing" | "failed" | "indexed";

function paragraphCount(paragraphs: unknown) {
  return Array.isArray(paragraphs) ? paragraphs.length : 0;
}

export function documentIndexStatus(input: {
  contentText?: string | null;
  paragraphs?: unknown;
  storagePath?: string | null;
}): DocumentIndexStatus {
  if (paragraphCount(input.paragraphs) > 0) return "indexed";

  const hasExtractedText = Boolean(input.contentText?.trim());
  if (hasExtractedText) return "failed";

  // Uploaded files may exist before extraction/segmentation finishes. Pasted
  // empty text also lands here instead of being mislabeled as indexed.
  if (input.storagePath || input.contentText === null || input.contentText === undefined) {
    return "processing";
  }

  return "failed";
}

export function documentIndexStatusLabel(status: DocumentIndexStatus) {
  if (status === "indexed") return "Indexed";
  if (status === "processing") return "Processing";
  return "Failed";
}

export function documentIndexStatusClass(status: DocumentIndexStatus) {
  if (status === "indexed") return "bg-approve-tint text-approve";
  if (status === "processing") return "bg-warn-tint text-warn";
  return "bg-reject-tint text-reject";
}
