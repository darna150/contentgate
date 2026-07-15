import { access, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { TemplateBundleFont, TemplateBundleManifest } from "./manifest.ts";
import {
  templateBundleImageFontWeight,
  type TemplateBundleImageFont,
} from "./fonts.ts";

function assetForFont(manifest: TemplateBundleManifest, font: TemplateBundleFont) {
  return manifest.assets.find((asset) => asset.key === font.asset) ?? null;
}

async function readIfExists(path: string) {
  try {
    await access(path);
    const buffer = await readFile(path);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
  } catch {
    return null;
  }
}

async function readPublicFontAsset(assetPath: string) {
  return (
    (await readIfExists(join(process.cwd(), "public", assetPath))) ??
    (await readIfExists(join(process.cwd(), "public", "fonts", basename(assetPath))))
  );
}

function toArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
  return data instanceof ArrayBuffer
    ? data
    : (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
}

/**
 * Ordered font resolution: in-memory bundle bytes (local preflight, before a
 * bundle is imported to storage) → `public/` (ContentGate's committed fonts)
 * → signed storage URL (imported, non-public client fonts). A bundle whose
 * font lives only in private storage previously had no way to resolve here,
 * which broke both the fit engine and local preflight for any non-Inter,
 * non-`public/fonts` client font.
 */
export async function loadTemplateBundleFontData(input: {
  manifest: TemplateBundleManifest;
  font: TemplateBundleFont;
  assetUrlByPath?: Record<string, string>;
  assetDataByPath?: Record<string, ArrayBuffer | Uint8Array>;
}) {
  const asset = assetForFont(input.manifest, input.font);
  if (!asset) return null;

  const inMemory = input.assetDataByPath?.[asset.path];
  if (inMemory) return toArrayBuffer(inMemory);

  const publicData = await readPublicFontAsset(asset.path);
  if (publicData) return publicData;

  const signedUrl = input.assetUrlByPath?.[asset.path];
  if (!signedUrl) return null;
  const response = await fetch(signedUrl, { cache: "no-store" });
  if (!response.ok) return null;
  return response.arrayBuffer();
}

export async function loadTemplateBundleImageFonts(input: {
  manifest: TemplateBundleManifest;
  assetUrlByPath?: Record<string, string>;
}): Promise<TemplateBundleImageFont[]> {
  const fonts = await Promise.all(
    input.manifest.fonts.map(async (font) => {
      const data = await loadTemplateBundleFontData({
        manifest: input.manifest,
        font,
        assetUrlByPath: input.assetUrlByPath,
      });
      return data
        ? {
            name: font.family,
            data,
            weight: templateBundleImageFontWeight(font.weight),
            style: font.style,
          }
        : { failedKey: font.key };
    })
  );
  const loaded = fonts.filter(
    (font): font is TemplateBundleImageFont => !("failedKey" in font)
  );
  const failedKeys = fonts
    .filter((font): font is { failedKey: string } => "failedKey" in font)
    .map((font) => font.failedKey);
  if (failedKeys.length > 0) {
    // Render routes fall back to a default font family when nothing loads
    // (fonts.length === 0). That fallback is silent by design elsewhere —
    // this is the one place that can name exactly which bundle and which
    // declared font failed, so a wrong-font render shows up in logs instead
    // of only in a client's eventual complaint.
    console.error(
      `[template-platform] ${failedKeys.length}/${input.manifest.fonts.length} declared font(s) ` +
        `failed to load for ${input.manifest.family.key}@${input.manifest.version.name}: ` +
        `${failedKeys.join(", ")}.` +
        (loaded.length === 0
          ? " Rendering with fallback fonts instead of the bundle's own."
          : " Rendering with a partial font set; unloaded weights/styles will fall back.")
    );
  }
  return loaded;
}
