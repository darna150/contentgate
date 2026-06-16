import "server-only";

const PLAIN_TEXT_EXTENSIONS = new Set(["txt", "text"]);
const PARSER_EXTENSIONS = new Set([
  "docx",
  "pptx",
  "xlsx",
  "odt",
  "odp",
  "ods",
  "pdf",
  "rtf",
  "csv",
  "md",
  "markdown",
  "html",
  "htm",
]);

function extension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function documentFileType(file: File): string {
  return extension(file.name) || file.type || "unknown";
}

export async function extractDocumentText(file: File): Promise<string | null> {
  const ext = extension(file.name);
  if (PLAIN_TEXT_EXTENSIONS.has(ext) || file.type.startsWith("text/plain")) {
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
