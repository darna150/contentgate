import {
  defaultTemplateSize,
  TEMPLATE_OUTPUT_SIZES,
  type TemplateSizeKey,
} from "./template-contract";

// Kept as a public alias while the engine contract owns output dimensions.
export const SIZES = TEMPLATE_OUTPUT_SIZES;
export type SizeKey = TemplateSizeKey;

// Which sizes each asset category may export at.
export const CATEGORY_SIZES: Record<string, SizeKey[]> = {
  social: ["square", "story", "feed"],
  flyer: ["a4"],
  one_pager: ["a4"],
  presentation: ["feed"],
};

export function defaultSizeFor(category: string): SizeKey {
  return defaultTemplateSize({ layoutKey: "", category });
}

export function renderUrl(contentId: string, size: SizeKey): string {
  return `/api/creative/render?content=${contentId}&size=${size}`;
}

export function draftPreviewUrl(contentId: string, size: SizeKey, cacheKey?: string | null): string {
  const params = new URLSearchParams({ content: contentId, size });
  if (cacheKey) params.set("v", cacheKey);
  return `/api/creative/draft-preview?${params.toString()}`;
}

export function templatePreviewUrl(templateId: string, size: SizeKey): string {
  return `/api/creative/template-preview?template=${templateId}&size=${size}`;
}

function assetFormatForSize(size: SizeKey): "square" | "story" | "feed" | "flyer" {
  if (size === "story") return "story";
  if (size === "feed") return "feed";
  if (size === "a4") return "flyer";
  return "square";
}

function templateAssetFamily(layoutKey: string): string | null {
  if (layoutKey.startsWith("digestpro_")) return "digestpro";
  if (layoutKey.startsWith("caniguard5_")) return "caniguard5";
  if (layoutKey.startsWith("poultryshieldpro_")) return "poultryshieldpro";
  if (layoutKey.startsWith("swineguardplus_")) return "swineguardplus";
  if (layoutKey.startsWith("vitalbite_")) return "vitalbite";
  if (layoutKey.startsWith("apex_canine_")) return "apex-canine";
  return null;
}

export function templateReferenceAssetUrl(
  layoutKey: string,
  size: SizeKey
): string | null {
  const family = templateAssetFamily(layoutKey);
  if (!family) return null;
  const extension = family === "apex-canine" ? "jpg" : "png";
  return `/assets/${family}/${family}-${assetFormatForSize(size)}-reference.${extension}`;
}

export function originalTemplatePreviewUrl(
  templateId: string,
  layoutKey: string,
  size: SizeKey
): string {
  return templateReferenceAssetUrl(layoutKey, size) ?? templatePreviewUrl(templateId, size);
}
