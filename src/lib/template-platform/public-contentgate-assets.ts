import type { TemplateBundleManifest } from "./manifest";

export const CONTENTGATE_PUBLIC_ASSET_VERSION = "vector-figwright-2026-07-19-01";

type ContentGateAssetKind = "reference" | "background";

const CONTENTGATE_PUBLIC_PACKAGE_BY_FAMILY: Record<string, "set-a" | "set-b"> = {
  "aerform-air01-campaign": "set-a",
  "contentgate-local-friendly": "set-a",
  "contentgate-local-premium": "set-b",
};

const CONTENTGATE_PUBLIC_FILENAME_BY_VARIANT: Record<string, string> = {
  leaderboard: "leaderboard.png",
  linkedin_square: "linkedin-square.png",
  link_ad: "link-ad.png",
  medium_rectangle: "medium-rectangle.png",
  portrait: "portrait.png",
  poster: "poster.png",
  rack_card: "rack-card.png",
  square: "square.png",
  story: "story.png",
  us_letter: "us-letter.png",
};

export function isPublicContentGateBundle(manifest: TemplateBundleManifest) {
  return (
    (manifest.version.name === "figwright-v1" || manifest.version.name === "v1") &&
    (manifest.family.key.startsWith("contentgate-local-") ||
      manifest.family.key === "aerform-air01-campaign")
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

  if (manifest.family.key === "aerform-air01-campaign") {
    const assetPath =
      kind === "background"
        ? `/template-packages/contentgate/${packageKey}/backgrounds/${filename}`
        : `/template-packages/contentgate/${packageKey}/${filename}`;
    return `${assetPath}?v=${CONTENTGATE_PUBLIC_ASSET_VERSION}`;
  }

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

  const backgroundOptionMatch = normalized.match(
    /(?:^|\/)variants\/([^/]+)\/background-([^/]+)\.png$/i
  );
  if (backgroundOptionMatch) {
    return {
      variantKey: `${backgroundOptionMatch[1]}::${backgroundOptionMatch[2]}`,
      kind: "background",
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
  if (inferred?.variantKey.includes("::") && manifest.family.key === "aerform-air01-campaign") {
    const [variantKey, optionKey] = inferred.variantKey.split("::");
    const packageKey = CONTENTGATE_PUBLIC_PACKAGE_BY_FAMILY[manifest.family.key];
    const filename = CONTENTGATE_PUBLIC_FILENAME_BY_VARIANT[variantKey];
    if (packageKey && filename) {
      return `/template-packages/contentgate/${packageKey}/background-options/${optionKey}/${filename}?v=${CONTENTGATE_PUBLIC_ASSET_VERSION}`;
    }
  }
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
