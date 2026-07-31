import type { TemplateBundleManifest } from "./manifest";

export const CONTENTGATE_PUBLIC_ASSET_VERSION = "vector-figwright-2026-07-19-01";
const NIMBUS_PUBLIC_PREVIEW_VERSION = "nimbus-reference-previews-2026-07-29-01";
const NIMBUS_PRODUCT_PREVIEW_VERSION = "nimbus-product-previews-2026-07-29-01";

type ContentGateAssetKind = "reference" | "background";

const CONTENTGATE_PUBLIC_PACKAGE_BY_FAMILY: Record<string, "set-b"> = {
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
  if (
    kind === "reference" &&
    manifest.family.key === "nimbus-air-campaign" &&
    manifest.variants.some((variant) => variant.key === variantKey)
  ) {
    return `/template-previews/nimbus-air-campaign/${variantKey}.png?v=${NIMBUS_PUBLIC_PREVIEW_VERSION}`;
  }

  const packageKey = CONTENTGATE_PUBLIC_PACKAGE_BY_FAMILY[manifest.family.key];
  const filename = CONTENTGATE_PUBLIC_FILENAME_BY_VARIANT[variantKey];
  if (!packageKey || !filename) return null;

  const assetPath =
    kind === "background"
      ? `/template-packages/contentgate/${packageKey}/backgrounds/${filename}`
      : `/template-packages/contentgate/${packageKey}/${filename}`;
  return `${assetPath}?v=${CONTENTGATE_PUBLIC_ASSET_VERSION}`;
}

/**
 * Lightweight, public assets used only by the interactive Studio canvas.
 * Authenticated render/export routes continue to resolve the original bundle
 * assets, so replacing a product in Studio is fast without lowering exports.
 */
export function publicTemplateStudioAssetPath(
  manifest: TemplateBundleManifest,
  assetPath: string
) {
  const normalized = assetPath.replace(/^\/+/, "");
  if (
    manifest.family.key === "nimbus-air-campaign" &&
    /^products\/[^/]+\.png$/i.test(normalized) &&
    manifest.assets.some((asset) => asset.kind === "image" && asset.path === normalized)
  ) {
    return `/template-previews/nimbus-air-campaign/${normalized}?v=${NIMBUS_PRODUCT_PREVIEW_VERSION}`;
  }
  return null;
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
    /^template-packages\/contentgate\/set-b\/(?:(backgrounds)\/)?([^/]+)\.png$/i
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
