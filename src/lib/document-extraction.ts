import "server-only";
import {
  DOCUMENT_MIME_BY_EXTENSION,
  documentExtension,
} from "@/lib/document-files";

const PLAIN_TEXT_EXTENSIONS = new Set(["txt", "text"]);
const PARSER_EXTENSIONS = new Set(
  Object.keys(DOCUMENT_MIME_BY_EXTENSION).filter(
    (value) => !PLAIN_TEXT_EXTENSIONS.has(value)
  )
);

export async function extractDocumentText(file: File): Promise<string | null> {
  const ext = documentExtension(file.name);
  if (PLAIN_TEXT_EXTENSIONS.has(ext)) {
    return (await file.text()).trim();
  }
  if (!PARSER_EXTENSIONS.has(ext)) return null;

  const { OfficeParser } = await import("officeparser");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileType =
    ext === "markdown" ? "md" : ext === "htm" ? "html" : ext;
  const ast = await OfficeParser.parseOffice(bytes, {
    fileType: fileType as
      | "docx"
      | "pptx"
      | "xlsx"
      | "odt"
      | "odp"
      | "ods"
      | "pdf"
      | "rtf"
      | "csv"
      | "md"
      | "html",
    ignoreComments: true,
    includeRawContent: false,
  });
  return ast.toText().trim();
}
