export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const DOCUMENT_MIME_BY_EXTENSION: Record<string, string> = {
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  htm: "text/html",
  html: "text/html",
  markdown: "text/markdown",
  md: "text/markdown",
  odp: "application/vnd.oasis.opendocument.presentation",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odt: "application/vnd.oasis.opendocument.text",
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  rtf: "application/rtf",
  text: "text/plain",
  txt: "text/plain",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function documentExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function documentFileType(file: File): string {
  return documentExtension(file.name) || file.type || "unknown";
}

export function validateDocumentFile(file: File): string {
  if (file.size === 0) throw new Error("Choose a document.");
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error("Documents must be 10 MB or smaller.");
  }

  const contentType = DOCUMENT_MIME_BY_EXTENSION[documentExtension(file.name)];
  if (!contentType) {
    throw new Error(
      "Use PDF, DOCX, PPTX, XLSX, OpenDocument, RTF, CSV, Markdown, HTML, or plain text."
    );
  }
  return contentType;
}
