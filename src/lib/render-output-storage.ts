import type { ServerExportFormat } from "./server-export-formats";

function storageSafeSegment(value: string) {
  return (
    value
      .replace(/[^\w\d-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "render"
  );
}

export function renderOutputStoragePath(input: {
  orgId: string;
  contentId: string;
  revision: number | null;
  variantKey: string;
  format: ServerExportFormat;
  inputSha256: string;
  extension: string;
}) {
  return [
    input.orgId,
    input.contentId,
    `revision-${input.revision ?? "unknown"}`,
    `${storageSafeSegment(input.variantKey)}-${input.format}-${input.inputSha256.slice(0, 12)}.${input.extension}`,
  ].join("/");
}
