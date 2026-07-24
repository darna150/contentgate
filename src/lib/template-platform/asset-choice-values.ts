import type { TemplateBundleField } from "./manifest.ts";

export const LEGACY_PRODUCT_VARIANT_FIELD = "__productVariantKey";

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function resolveTemplateAssetChoiceValues(input: {
  fields: readonly TemplateBundleField[];
  requestedChoices?: Record<string, unknown> | null;
  legacyProductVariantChoice?: unknown;
  replaceFields?: Record<string, string> | null;
  campaignSourceFields?: Record<string, string> | null;
  defaultCopy?: Record<string, string> | null;
}) {
  const values: Record<string, string> = {};
  for (const field of input.fields) {
    const value =
      nonEmptyString(input.requestedChoices?.[field.key]) ??
      (field.key === LEGACY_PRODUCT_VARIANT_FIELD
        ? nonEmptyString(input.legacyProductVariantChoice)
        : null) ??
      nonEmptyString(input.replaceFields?.[field.key]) ??
      nonEmptyString(input.campaignSourceFields?.[field.key]) ??
      nonEmptyString(input.defaultCopy?.[field.key]) ??
      (typeof field.defaultValue === "string" ? field.defaultValue : null) ??
      field.options?.[0] ??
      null;

    if (value) values[field.key] = value;
  }
  return values;
}
