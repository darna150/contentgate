export function templateReferenceExportUrl(input: {
  templateId: string;
  platformAssignmentId?: string | null;
  size: string;
}): string {
  const params = new URLSearchParams();
  if (input.platformAssignmentId) {
    params.set("assignment", input.platformAssignmentId);
  } else {
    params.set("template", input.templateId);
  }
  params.set("size", input.size);
  return `/api/creative/template-preview?${params.toString()}`;
}
