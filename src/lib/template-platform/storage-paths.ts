import type { TemplateBundleAsset } from "./manifest";

export function normalizeTemplateBundleStoragePrefix(prefix: string) {
  return prefix
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

export function safeTemplateBundleStorageFileName(assetPath: string) {
  return (
    assetPath
      .split("/")
      .filter(Boolean)
      .at(-1)
      ?.replace(/[^a-zA-Z0-9._-]+/g, "-") || "asset"
  );
}

export function templateBundleAssetStoragePath(
  storagePrefix: string,
  asset: Pick<TemplateBundleAsset, "path" | "sha256">
) {
  return [
    normalizeTemplateBundleStoragePrefix(storagePrefix),
    "assets",
    asset.sha256,
    safeTemplateBundleStorageFileName(asset.path),
  ]
    .filter(Boolean)
    .join("/");
}
