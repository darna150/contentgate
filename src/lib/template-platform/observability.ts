export type TemplatePipelineEvent = {
  event:
    | "template.preflight"
    | "template.import"
    | "template.publish"
    | "template.generate";
  ok: boolean;
  orgId?: string | null;
  userId?: string | null;
  familyKey?: string | null;
  versionName?: string | null;
  variantKey?: string | null;
  templateVersionId?: string | null;
  templateFamilyId?: string | null;
  platformAssignmentId?: string | null;
  productId?: string | null;
  issueCount?: number;
  assetCount?: number;
  damBoundFieldCount?: number;
  durationMs?: number;
  reason?: string;
};

function cleanEvent(event: TemplatePipelineEvent) {
  return Object.fromEntries(
    Object.entries(event).filter(([, value]) => value !== undefined && value !== null)
  );
}

export function logTemplatePipelineEvent(event: TemplatePipelineEvent) {
  const payload = cleanEvent(event);
  const message = "template_pipeline_event";
  if (event.ok) {
    console.info(message, payload);
  } else {
    console.warn(message, payload);
  }
}

export function templatePipelineDuration(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}
