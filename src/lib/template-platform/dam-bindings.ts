import type { TemplateBundleField } from "./manifest.ts";

export type TemplateDamAssetRow = {
  id: string;
  product_id: string | null;
  asset_type: string;
  title: string | null;
  storage_path: string;
  mime_type: string | null;
  media_kind: string | null;
  category: string | null;
  tags: string[] | null;
};

export type TemplateAssetChoiceOption = {
  key: string;
  label: string;
  previewUrl?: string;
  storagePath?: string;
};

function normalizedTags(tags: readonly string[] | null | undefined) {
  return new Set((tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean));
}

export function fieldHasDamBinding(field: TemplateBundleField) {
  return field.assetBinding?.source === "product_assets";
}

export function assetMatchesTemplateBinding(input: {
  asset: TemplateDamAssetRow;
  field: TemplateBundleField;
  productId: string;
}) {
  const binding = input.field.assetBinding;
  if (!binding || binding.source !== "product_assets") return false;

  const scope = binding.scope ?? "product_or_brand";
  if (scope === "product" && input.asset.product_id !== input.productId) return false;
  if (scope === "brand" && input.asset.product_id !== null) return false;
  if (
    scope === "product_or_brand" &&
    input.asset.product_id !== input.productId &&
    input.asset.product_id !== null
  ) {
    return false;
  }

  if (binding.mediaKind && input.asset.media_kind !== binding.mediaKind) return false;
  if (binding.assetType && input.asset.asset_type !== binding.assetType) return false;
  if (binding.category && input.asset.category !== binding.category) return false;

  const assetTags = normalizedTags(input.asset.tags);
  return (binding.tags ?? []).every((tag) => assetTags.has(tag.trim().toLowerCase()));
}

export function buildTemplateAssetChoiceOptions(input: {
  field: TemplateBundleField;
  productId: string;
  assets: readonly TemplateDamAssetRow[];
  previewUrlByStoragePath?: ReadonlyMap<string, string>;
}): TemplateAssetChoiceOption[] {
  if (!fieldHasDamBinding(input.field)) {
    return (input.field.options ?? []).map((key) => ({ key, label: key }));
  }

  return input.assets
    .filter((asset) =>
      assetMatchesTemplateBinding({
        asset,
        field: input.field,
        productId: input.productId,
      })
    )
    .map((asset) => ({
      key: asset.id,
      label: asset.title ?? asset.id,
      previewUrl: input.previewUrlByStoragePath?.get(asset.storage_path),
      storagePath: asset.storage_path,
    }));
}

export function selectedTemplateAssetUrl(input: {
  field: TemplateBundleField | undefined;
  selectedValue: unknown;
  damAssetUrlById?: Record<string, string>;
}) {
  if (typeof input.selectedValue !== "string" || input.selectedValue.length === 0) {
    return null;
  }
  if (input.field && fieldHasDamBinding(input.field)) {
    return input.damAssetUrlById?.[input.selectedValue] ?? null;
  }
  return null;
}
