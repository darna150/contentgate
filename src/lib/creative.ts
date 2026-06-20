// Locked-template render config. Text always comes from approved content;
// the only choice users get is the output size. Design is locked.

export const SIZES = {
  square: { label: "Square", w: 1080, h: 1080 },
  story: { label: "Story", w: 1080, h: 1920 },
  feed: { label: "Feed", w: 1200, h: 630 },
  a4: { label: "A4 Flyer", w: 1240, h: 1754 },
} as const;

export type SizeKey = keyof typeof SIZES;

// Which sizes each asset category may export at.
export const CATEGORY_SIZES: Record<string, SizeKey[]> = {
  social: ["square", "story", "feed"],
  flyer: ["a4"],
  one_pager: ["a4"],
  presentation: ["feed"],
};

export function defaultSizeFor(category: string): SizeKey {
  return CATEGORY_SIZES[category]?.[0] ?? "square";
}

export function renderUrl(contentId: string, size: SizeKey): string {
  return `/api/creative/render?content=${contentId}&size=${size}`;
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
