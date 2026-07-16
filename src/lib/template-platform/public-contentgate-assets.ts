import type { TemplateBundleManifest } from "./manifest";

export const CONTENTGATE_PUBLIC_ASSET_VERSION = "clean-figwright-2026-07-16-05";

type ContentGateAssetKind = "reference" | "background";

const CONTENTGATE_PUBLIC_PACKAGE_BY_FAMILY: Record<string, "set-a" | "set-b"> = {
  "contentgate-local-friendly": "set-a",
  "contentgate-local-premium": "set-b",
};

const CONTENTGATE_PUBLIC_FILENAME_BY_VARIANT: Record<string, string> = {
  leaderboard: "leaderboard.png",
  link_ad: "link-ad.png",
  medium_rectangle: "medium-rectangle.png",
  portrait: "portrait.png",
  square: "square.png",
  story: "story.png",
};

export function isPublicContentGateBundle(manifest: TemplateBundleManifest) {
  return (
    manifest.version.name === "figwright-v1" &&
    manifest.family.key.startsWith("contentgate-local-")
  );
}

export function publicContentGateBundleVariantAssetPath(
  manifest: TemplateBundleManifest,
  variantKey: string,
  kind: ContentGateAssetKind
) {
  const packageKey = CONTENTGATE_PUBLIC_PACKAGE_BY_FAMILY[manifest.family.key];
  const filename = CONTENTGATE_PUBLIC_FILENAME_BY_VARIANT[variantKey];
  if (!packageKey || !filename) return null;

  const assetPath =
    kind === "background"
      ? `/template-bundles/${manifest.family.key}/figwright-v1/variants/${variantKey}/background.png`
      : `/template-bundles/${manifest.family.key}/figwright-v1/variants/${variantKey}/reference.png`;
  return `${assetPath}?v=${CONTENTGATE_PUBLIC_ASSET_VERSION}`;
}

function inferVariantAssetKindFromPath(assetPath: string):
  | { variantKey: string; kind: ContentGateAssetKind }
  | null {
  const normalized = assetPath.replace(/^\/+/, "");
  const variantMatch = normalized.match(
    /(?:^|\/)variants\/([^/]+)\/(reference|background)\.png$/i
  );
  if (variantMatch) {
    return {
      variantKey: variantMatch[1],
      kind: variantMatch[2].toLowerCase() as ContentGateAssetKind,
    };
  }

  const packageMatch = normalized.match(
    /^template-packages\/contentgate\/set-[ab]\/(?:(backgrounds)\/)?([^/]+)\.png$/i
  );
  if (!packageMatch) return null;
  const variantKey = packageMatch[2].replace(/-/g, "_");
  return {
    variantKey,
    kind: packageMatch[1] ? "background" : "reference",
  };
}

export function publicContentGateBundleAssetPath(
  manifest: TemplateBundleManifest,
  assetPath: string
) {
  if (!isPublicContentGateBundle(manifest)) return null;
  const inferred = inferVariantAssetKindFromPath(assetPath);
  if (inferred) {
    return publicContentGateBundleVariantAssetPath(
      manifest,
      inferred.variantKey,
      inferred.kind
    );
  }
  if (assetPath.startsWith("template-packages/contentgate/")) {
    return `/${assetPath}?v=${CONTENTGATE_PUBLIC_ASSET_VERSION}`;
  }
  if (assetPath.startsWith("/template-packages/contentgate/")) {
    return `${assetPath}?v=${CONTENTGATE_PUBLIC_ASSET_VERSION}`;
  }
  return `/template-bundles/${manifest.family.key}/${manifest.version.name}/${assetPath}?v=${CONTENTGATE_PUBLIC_ASSET_VERSION}`;
}
