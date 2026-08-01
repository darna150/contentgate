import type { TemplateBundleManifest } from "./manifest";
import { getTemplateBundleVariantBackgroundOptions } from "./runtime";

export function getTemplateProductAssetPath(
  manifest: TemplateBundleManifest,
  productKey: string
) {
  return manifest.assets.find(
    (asset) =>
      asset.kind === "image" &&
      (asset.key === `product-${productKey}` ||
        asset.path === `products/${productKey}.png` ||
        asset.path.endsWith(`/${productKey}.png`))
  )?.path;
}

export function getTemplateProductAssetPaths(manifest: TemplateBundleManifest) {
  return manifest.assets
    .filter((asset) => asset.kind === "image" && asset.path.startsWith("products/"))
    .map((asset) => asset.path);
}

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
  const productPaths = getTemplateProductAssetPaths(manifest);
  const fontPaths = manifest.fonts.flatMap((font) => {
    const asset = manifest.assets.find((item) => item.key === font.asset);
    return asset ? [asset.path] : [];
  });

  return [...new Set([...backgroundPaths, ...productPaths, ...fontPaths])];
}
