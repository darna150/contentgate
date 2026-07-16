import type { TemplateBundleManifest } from "./manifest";

export const CONTENTGATE_PUBLIC_ASSET_VERSION = "clean-figwright-2026-07-16-04";

export function isPublicContentGateBundle(manifest: TemplateBundleManifest) {
  return (
    manifest.version.name === "figwright-v1" &&
    manifest.family.key.startsWith("contentgate-local-")
  );
}

export function publicContentGateBundleAssetPath(
  manifest: TemplateBundleManifest,
  assetPath: string
) {
  if (!isPublicContentGateBundle(manifest)) return null;
  if (assetPath.startsWith("template-packages/contentgate/")) {
    return `/${assetPath}?v=${CONTENTGATE_PUBLIC_ASSET_VERSION}`;
  }
  if (assetPath.startsWith("/template-packages/contentgate/")) {
    return `${assetPath}?v=${CONTENTGATE_PUBLIC_ASSET_VERSION}`;
  }
  return `/template-bundles/${manifest.family.key}/${manifest.version.name}/${assetPath}?v=${CONTENTGATE_PUBLIC_ASSET_VERSION}`;
}
