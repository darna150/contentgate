import type { TemplateBundleManifest } from "./manifest";
import { getTemplateBundleVariantBackgroundOptions } from "./runtime";

/**
 * Assets required to render one editable Studio canvas. Reference exports are
 * intentionally omitted: the reference view uses the authenticated preview
 * route, while the local draft canvas only needs the selected size's
 * backgrounds, the product choices, and embedded fonts.
 */
export function getTemplateVariantRenderAssetPaths(
  manifest: TemplateBundleManifest,
  variantKey: string
) {
  const backgroundPaths = getTemplateBundleVariantBackgroundOptions(manifest, variantKey).flatMap(
    (option) => [option.assetPath, option.thumbnailAssetPath]
  );
  const productPaths = manifest.assets
    .filter((asset) => asset.kind === "image")
    .map((asset) => asset.path);
  const fontPaths = manifest.fonts.flatMap((font) => {
    const asset = manifest.assets.find((item) => item.key === font.asset);
    return asset ? [asset.path] : [];
  });

  return [...new Set([...backgroundPaths, ...productPaths, ...fontPaths])];
}
