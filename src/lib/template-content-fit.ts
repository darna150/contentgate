import {
  getTemplateLayoutContract,
  isTemplateContractReady,
  isTemplateSizeAllowed,
  TEMPLATE_OUTPUT_SIZES,
  type TemplateSizeKey,
} from "./template-contract";
import {
  getPublishedTemplateFrameFieldLimits,
} from "./published-template-package";
import {
  formatPublishedTemplateFitIssues,
  publishedTemplateFieldFitIssues,
} from "./published-template-fit";
import {
  mergeFieldLimits,
  templateFieldIssues,
  type FieldLimits,
} from "./template-fields";
import { resolveEffectiveFieldLimits } from "./template-specs";

export type TemplateContentFitInput = {
  layoutKey: string;
  category: string;
  editableFields: string[];
  fieldLimits: FieldLimits;
  lockedFields: string[];
  definition: unknown;
  status: string;
  fields: Record<string, unknown>;
  promptContext?: unknown;
  requestedSize?: string | null;
};

export function storedOutputSize(promptContext: unknown): TemplateSizeKey | null {
  if (!promptContext || typeof promptContext !== "object") return null;
  const value = (promptContext as Record<string, unknown>).output_size;
  return typeof value === "string" && value in TEMPLATE_OUTPUT_SIZES
    ? (value as TemplateSizeKey)
    : null;
}

export async function validateTemplateContentFit(
  input: TemplateContentFitInput
): Promise<string | null> {
  const baseLimits = resolveEffectiveFieldLimits(input.layoutKey, input.fieldLimits);
  if (
    !isTemplateContractReady({
      layoutKey: input.layoutKey,
      category: input.category,
      editableFields: input.editableFields,
      fieldLimits: baseLimits,
      lockedFields: input.lockedFields,
      definition: input.definition,
      status: input.status,
    })
  ) {
    return "Template configuration does not meet the active engine contract.";
  }

  const contract = getTemplateLayoutContract(input.layoutKey);
  const outputSize = storedOutputSize(input.promptContext);
  if (contract?.renderer === "published-design" && !outputSize) {
    return "The generated asset is missing its locked output size.";
  }
  if (
    outputSize &&
    !isTemplateSizeAllowed(
      {
        layoutKey: input.layoutKey,
        category: input.category,
        definition: input.definition,
        status: input.status,
      },
      outputSize
    )
  ) {
    return "The generated asset uses an unsupported output size.";
  }
  if (input.requestedSize && outputSize && input.requestedSize !== outputSize) {
    return "The requested size does not match this generated asset.";
  }

  const frameLimits = outputSize
    ? getPublishedTemplateFrameFieldLimits(
        input.layoutKey,
        outputSize,
        input.definition
      )
    : null;
  const limits = mergeFieldLimits(baseLimits, frameLimits);
  const configuredIssues = templateFieldIssues(
    input.fields,
    input.editableFields,
    limits
  );
  const firstConfiguredField = input.editableFields.find(
    (field) => configuredIssues[field]?.length
  );
  if (firstConfiguredField) {
    return `${firstConfiguredField.replace(/_/g, " ")}: ${configuredIssues[firstConfiguredField][0].message}`;
  }

  if (outputSize) {
    const geometryIssues = await publishedTemplateFieldFitIssues({
      layoutKey: input.layoutKey,
      sizeKey: outputSize,
      fields: input.fields,
      definition: input.definition,
    });
    const firstGeometryIssue = formatPublishedTemplateFitIssues(geometryIssues)[0];
    if (firstGeometryIssue) return firstGeometryIssue;
  }

  return null;
}
