import type { TemplateBundleManifest } from "./manifest";

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
