import type { TemplateBundleAsset, TemplateBundleManifest } from "./manifest";

export type TemplateBundleStorageAssetRow = {
  template_version_id: string;
  asset_key: string;
  sha256: string;
  storage_path: string;
};

export function templateBundleStoragePath(
  orgId: string,
  manifest: TemplateBundleManifest,
  assetPath: string
) {
  return [
    orgId,
    "template-bundles",
    manifest.family.key,
    manifest.version.name,
    assetPath,
  ].join("/");
}

export function resolveTemplateBundleAssetStoragePath(input: {
  orgId: string;
  versionId: string;
  manifest: TemplateBundleManifest;
  asset: TemplateBundleAsset;
  storedAssets: readonly TemplateBundleStorageAssetRow[];
}) {
  const stored = input.storedAssets.find(
    (candidate) =>
      candidate.template_version_id === input.versionId &&
      candidate.asset_key === input.asset.key &&
      candidate.sha256 === input.asset.sha256 &&
      candidate.storage_path.startsWith(`${input.orgId}/`)
  );
  return (
    stored?.storage_path ??
    templateBundleStoragePath(input.orgId, input.manifest, input.asset.path)
  );
}
