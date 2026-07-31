export type TemplateVersionStorageIntegrity = {
  asset_count: number;
  present_asset_count: number;
  missing_asset_keys: unknown;
};

export type TemplateVersionStorageIntegrityDecision =
  | { ok: true; assetCount: number }
  | { ok: false; assetCount: number; presentAssetCount: number; missingAssetKeys: string[] };

function nonNegativeInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function decideTemplateVersionStorageIntegrity(
  integrity: TemplateVersionStorageIntegrity | null | undefined
): TemplateVersionStorageIntegrityDecision {
  const assetCount = nonNegativeInteger(integrity?.asset_count);
  const presentAssetCount = nonNegativeInteger(integrity?.present_asset_count);
  const missingAssetKeys = Array.isArray(integrity?.missing_asset_keys)
    ? integrity.missing_asset_keys.filter((key): key is string => typeof key === "string")
    : [];

  if (assetCount !== null && assetCount > 0 && presentAssetCount === assetCount) {
    return { ok: true, assetCount };
  }

  return {
    ok: false,
    assetCount: assetCount ?? 0,
    presentAssetCount: presentAssetCount ?? 0,
    missingAssetKeys,
  };
}
