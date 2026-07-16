import type {
  TemplateBundleFont,
  TemplateBundleManifest,
  TemplateBundleTextSlot,
} from "./manifest.ts";

export type TemplateBundleImageFont = {
  name: string;
  data: ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
};

function fallbackWeightFromKey(fontKey: string) {
  if (fontKey.includes("bold")) return 700;
  if (fontKey.includes("semibold")) return 600;
  if (fontKey.includes("medium")) return 500;
  return 400;
}

export function templateBundleImageFontWeight(weight: number): TemplateBundleImageFont["weight"] {
  if (weight <= 150) return 100;
  if (weight <= 250) return 200;
  if (weight <= 350) return 300;
  if (weight <= 450) return 400;
  if (weight <= 550) return 500;
  if (weight <= 650) return 600;
  if (weight <= 750) return 700;
  if (weight <= 850) return 800;
  return 900;
}

export function templateBundleFontForSlot(
  manifest: TemplateBundleManifest,
  slot: TemplateBundleTextSlot
): TemplateBundleFont | null {
  return manifest.fonts.find((font) => font.key === slot.fontKey) ?? null;
}

export function templateBundleFontWeight(
  manifest: TemplateBundleManifest,
  slot: TemplateBundleTextSlot
) {
  return templateBundleFontForSlot(manifest, slot)?.weight ?? fallbackWeightFromKey(slot.fontKey);
}

export function templateBundleFontFamily(
  manifest: TemplateBundleManifest,
  slot: TemplateBundleTextSlot
) {
  return templateBundleFontForSlot(manifest, slot)?.family ?? "Inter";
}

export function templateBundleFontStyle(
  manifest: TemplateBundleManifest,
  slot: TemplateBundleTextSlot
) {
  return templateBundleFontForSlot(manifest, slot)?.style ?? "normal";
}

export function templateBundleFontStack(
  manifest: TemplateBundleManifest,
  slot: TemplateBundleTextSlot
) {
  const family = templateBundleFontFamily(manifest, slot).replace(/"/g, '\\"');
  return `"${family}", "ContentGate Sans", "Inter", ui-sans-serif, system-ui, sans-serif`;
}

export function templateBundleFontDescription(
  manifest: TemplateBundleManifest,
  slot: TemplateBundleTextSlot
) {
  const family = templateBundleFontFamily(manifest, slot);
  const weight = templateBundleFontWeight(manifest, slot);
  return `${family} ${weight}`;
}
