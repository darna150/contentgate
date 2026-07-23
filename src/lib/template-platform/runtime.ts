import type { FieldLimits } from "../template-fields.ts";
import type {
  TemplateBundleBackgroundOption,
  TemplateBundleField,
  TemplateBundleManifest,
  TemplateBundleTextSlot,
  TemplateBundleVariant,
} from "./manifest.ts";

export const BACKGROUND_CHOICE_FIELD = "__backgroundAssetKey";

export type TemplateBundleRuntimeBackgroundOption = {
  key: string;
  label: string;
  assetKey: string;
  assetPath: string;
  thumbnailAssetKey?: string;
  thumbnailAssetPath: string;
};

export type TemplateBundleRuntimeVariant = {
  variant: TemplateBundleVariant;
  fields: TemplateBundleField[];
  fieldLimits: FieldLimits;
  referenceAssetPath: string;
  backgroundAssetPath: string;
  backgroundOptions: TemplateBundleRuntimeBackgroundOption[];
};

function textSlots(variant: TemplateBundleVariant): TemplateBundleTextSlot[] {
  return variant.slots.filter((slot): slot is TemplateBundleTextSlot => slot.kind === "text");
}

function assetPath(manifest: TemplateBundleManifest, assetKey: string) {
  return manifest.assets.find((asset) => asset.key === assetKey)?.path ?? null;
}

function defaultBackgroundOption(
  variant: TemplateBundleVariant
): TemplateBundleBackgroundOption {
  return {
    key: "default",
    label: "Default",
    asset: variant.backgroundAsset,
  };
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
  return manifest.fields.filter(
    (field) => visibleFields.has(field.key) && field.type === "text"
  );
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

export function getTemplateBundleVariantBackgroundOptions(
  manifest: TemplateBundleManifest,
  variantKey: string
): TemplateBundleRuntimeBackgroundOption[] {
  const variant = getTemplateBundleVariant(manifest, variantKey);
  if (!variant) return [];

  const declaredOptions = variant.backgroundOptions ?? [];
  const hasDefaultBackground = declaredOptions.some(
    (option) => option.key === "default" || option.asset === variant.backgroundAsset
  );
  const options = hasDefaultBackground
    ? declaredOptions
    : [defaultBackgroundOption(variant), ...declaredOptions];

  return options.flatMap((option) => {
    const resolvedAssetPath = assetPath(manifest, option.asset);
    if (!resolvedAssetPath) return [];
    const resolvedThumbnailPath =
      (option.thumbnailAsset ? assetPath(manifest, option.thumbnailAsset) : null) ??
      resolvedAssetPath;

    return [
      {
        key: option.key,
        label: option.label,
        assetKey: option.asset,
        assetPath: resolvedAssetPath,
        thumbnailAssetKey: option.thumbnailAsset,
        thumbnailAssetPath: resolvedThumbnailPath,
      },
    ];
  });
}

export function resolveTemplateBundleBackgroundAssetPath(
  manifest: TemplateBundleManifest,
  variant: TemplateBundleVariant,
  selectedBackgroundKey?: string | null
): string | null {
  const options = getTemplateBundleVariantBackgroundOptions(manifest, variant.key);
  const selected = selectedBackgroundKey
    ? options.find((option) => option.key === selectedBackgroundKey)
    : null;
  return selected?.assetPath ?? assetPath(manifest, variant.backgroundAsset);
}

export function resolveTemplateBundleRuntimeVariant(
  manifest: TemplateBundleManifest,
  variantKey: string,
  selectedBackgroundKey?: string | null
): TemplateBundleRuntimeVariant | null {
  const variant = getTemplateBundleVariant(manifest, variantKey);
  if (!variant) return null;
  const referenceAssetPath = assetPath(manifest, variant.referenceAsset);
  const backgroundAssetPath = resolveTemplateBundleBackgroundAssetPath(
    manifest,
    variant,
    selectedBackgroundKey
  );
  if (!referenceAssetPath || !backgroundAssetPath) return null;

  return {
    variant,
    fields: getTemplateBundleVariantFields(manifest, variantKey),
    fieldLimits: getTemplateBundleVariantFieldLimits(manifest, variantKey),
    referenceAssetPath,
    backgroundAssetPath,
    backgroundOptions: getTemplateBundleVariantBackgroundOptions(manifest, variantKey),
  };
}
