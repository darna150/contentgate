import type { FieldLimits } from "../template-fields.ts";
import type {
  TemplateBundleField,
  TemplateBundleManifest,
  TemplateBundleTextSlot,
  TemplateBundleVariant,
} from "./manifest.ts";

export type TemplateBundleRuntimeVariant = {
  variant: TemplateBundleVariant;
  fields: TemplateBundleField[];
  fieldLimits: FieldLimits;
  referenceAssetPath: string;
  backgroundAssetPath: string;
};

function textSlots(variant: TemplateBundleVariant): TemplateBundleTextSlot[] {
  return variant.slots.filter((slot): slot is TemplateBundleTextSlot => slot.kind === "text");
}

function assetPath(manifest: TemplateBundleManifest, assetKey: string) {
  return manifest.assets.find((asset) => asset.key === assetKey)?.path ?? null;
}

export function getTemplateBundleSupportedSizes(
  manifest: TemplateBundleManifest
): string[] {
  return manifest.variants.map((variant) => variant.key);
}

export function getTemplateBundleVariant(
  manifest: TemplateBundleManifest,
  variantKey: string
): TemplateBundleVariant | null {
  return manifest.variants.find((variant) => variant.key === variantKey) ?? null;
}

export function getTemplateBundleVariantLabel(
  manifest: TemplateBundleManifest,
  variantKey: string
): string {
  return getTemplateBundleVariant(manifest, variantKey)?.label ?? variantKey;
}

export function getTemplateBundleVariantDimensions(
  manifest: TemplateBundleManifest,
  variantKey: string
): { w: number; h: number } | null {
  const variant = getTemplateBundleVariant(manifest, variantKey);
  return variant ? { w: variant.width, h: variant.height } : null;
}

export function getTemplateBundleVariantFields(
  manifest: TemplateBundleManifest,
  variantKey: string
): TemplateBundleField[] {
  const variant = getTemplateBundleVariant(manifest, variantKey);
  if (!variant) return [];
  const visibleFields = new Set(variant.slots.map((slot) => slot.field));
  return manifest.fields.filter((field) => visibleFields.has(field.key));
}

export function getTemplateBundleVariantFieldLimits(
  manifest: TemplateBundleManifest,
  variantKey: string
): FieldLimits {
  const variant = getTemplateBundleVariant(manifest, variantKey);
  if (!variant) return {};

  const limits: FieldLimits = {};
  for (const slot of textSlots(variant)) {
    limits[slot.field] = {
      max_chars: slot.maxChars,
      max_words: slot.maxWords,
      max_lines: slot.maxLines,
    };
  }
  return limits;
}

export function resolveTemplateBundleRuntimeVariant(
  manifest: TemplateBundleManifest,
  variantKey: string
): TemplateBundleRuntimeVariant | null {
  const variant = getTemplateBundleVariant(manifest, variantKey);
  if (!variant) return null;
  const referenceAssetPath = assetPath(manifest, variant.referenceAsset);
  const backgroundAssetPath = assetPath(manifest, variant.backgroundAsset);
  if (!referenceAssetPath || !backgroundAssetPath) return null;

  return {
    variant,
    fields: getTemplateBundleVariantFields(manifest, variantKey),
    fieldLimits: getTemplateBundleVariantFieldLimits(manifest, variantKey),
    referenceAssetPath,
    backgroundAssetPath,
  };
}
