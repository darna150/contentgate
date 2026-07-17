import * as opentype from "opentype.js";
import type { Font, Glyph } from "opentype.js";

import type { TemplateBundleManifest, TemplateBundleTextSlot } from "./manifest.ts";
import {
  templateBundleFontDescription,
  templateBundleFontForSlot,
} from "./fonts.ts";
import { loadTemplateBundleFontData } from "./server-fonts.ts";
import { getTemplateBundleVariant } from "./runtime.ts";

export type TemplatePlatformFitIssue = {
  field: string;
  type: "height" | "lines" | "width";
  message: string;
};

export type TemplatePlatformTextLayout = {
  lines: string[];
  lineWidths: number[];
  overlongWords: string[];
  renderedHeight: number;
};

export type TemplatePlatformFontSource = {
  assetUrlByPath?: Record<string, string>;
  assetDataByPath?: Record<string, ArrayBuffer | Uint8Array>;
};

const fontPromises = new Map<string, Promise<Font>>();
const parseFont =
  opentype.parse ??
  (opentype as typeof opentype & { default?: { parse?: typeof opentype.parse } })
    .default?.parse;

async function loadTemplateFont(
  manifest: TemplateBundleManifest,
  slot: TemplateBundleTextSlot,
  fontSource?: TemplatePlatformFontSource
): Promise<Font> {
  const font = templateBundleFontForSlot(manifest, slot);
  const cacheKey = font
    ? `${manifest.family.key}:${manifest.version.name}:${font.key}:${font.sha256}`
    : `fallback:${slot.fontKey}`;
  let promise = fontPromises.get(cacheKey);
  if (!promise) {
    promise = (async () => {
      if (!font) {
        throw new Error(`Font "${slot.fontKey}" is not declared in template bundle.`);
      }
      const data = await loadTemplateBundleFontData({
        manifest,
        font,
        assetUrlByPath: fontSource?.assetUrlByPath,
        assetDataByPath: fontSource?.assetDataByPath,
      });
      if (!data) {
        throw new Error(`Font asset for "${font.key}" could not be loaded.`);
      }
      return parseFont!(data);
    })();
    // A failed load (missing asset, transient network error on the signed
    // URL fetch) must not poison this cache key forever — evict on
    // rejection so the next call retries instead of failing every fit check
    // and every render for the rest of the process lifetime.
    promise.catch(() => {
      if (fontPromises.get(cacheKey) === promise) fontPromises.delete(cacheKey);
    });
    fontPromises.set(cacheKey, promise);
  }
  return promise;
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function glyphWidth(
  font: Font,
  text: string,
  fontSize: number,
  letterSpacing = 0
) {
  const glyphs = Array.from(text).map((character) => font.charToGlyph(character));
  let units = 0;
  for (let index = 0; index < glyphs.length; index += 1) {
    const glyph = glyphs[index];
    units += glyph.advanceWidth ?? 0;
    const nextGlyph: Glyph | undefined = glyphs[index + 1];
    if (nextGlyph) units += font.getKerningValue(glyph, nextGlyph);
  }
  const spacing = Math.max(0, glyphs.length - 1) * letterSpacing;
  return (units / font.unitsPerEm) * fontSize + spacing;
}

function textSlots(manifest: TemplateBundleManifest, variantKey: string) {
  const variant = getTemplateBundleVariant(manifest, variantKey);
  return (
    variant?.slots.filter((slot): slot is TemplateBundleTextSlot => slot.kind === "text") ??
    []
  );
}

function trimLastWord(value: string) {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return value.slice(0, Math.max(0, value.length - 1)).trim();
  return words.slice(0, -1).join(" ").trim();
}

function descenderPadding(slot: TemplateBundleTextSlot, fontSize: number) {
  const lineBoxHeight = fontSize * slot.lineHeight * slot.maxLines;
  return Math.max(0, Math.min(fontSize * 0.12, slot.height - lineBoxHeight));
}

async function measureAtSize(
  manifest: TemplateBundleManifest,
  slot: TemplateBundleTextSlot,
  text: string,
  fontSize: number,
  fontSource?: TemplatePlatformFontSource
): Promise<TemplatePlatformTextLayout> {
  if (!text) {
    return { lines: [], lineWidths: [], overlongWords: [], renderedHeight: 0 };
  }

  const font = await loadTemplateFont(manifest, slot, fontSource);
  const measure = (line: string) =>
    glyphWidth(font, line, fontSize, slot.letterSpacing ?? 0);
  const lines: string[] = [];
  const overlongWords = new Set<string>();

  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let current = "";

    for (const word of words) {
      if (measure(word) > slot.width) overlongWords.add(word);
      const candidate = current ? `${current} ${word}` : word;
      if (!current || measure(candidate) <= slot.width) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
  }

  return {
    lines,
    lineWidths: lines.map(measure),
    overlongWords: [...overlongWords],
    renderedHeight:
      lines.length * fontSize * slot.lineHeight +
      (lines.length > 0 ? descenderPadding(slot, fontSize) : 0),
  };
}

function fitsLayout(layout: TemplatePlatformTextLayout, slot: TemplateBundleTextSlot) {
  return (
    layout.overlongWords.length === 0 &&
    layout.lines.length <= slot.maxLines &&
    layout.renderedHeight <= slot.height + 0.5
  );
}

export async function measureTemplatePlatformTextSlot(
  manifest: TemplateBundleManifest,
  value: unknown,
  slot: TemplateBundleTextSlot,
  fontSource?: TemplatePlatformFontSource
): Promise<TemplatePlatformTextLayout> {
  return measureAtSize(manifest, slot, cleanText(value), slot.fontSize, fontSource);
}

export type TemplatePlatformResolvedTextLayout = TemplatePlatformTextLayout & {
  /** The font size actually chosen. Equal to slot.fontSize for "fixed" slots. */
  fontSize: number;
  /** True when some size in the slot's allowed range renders without overflow. */
  fits: boolean;
};

/**
 * Resolve the font size + explicit line breaks a text slot should render at.
 * "fixed" slots (or shrink_to_fit slots missing a usable minFontSize) always
 * resolve at slot.fontSize, unchanged from prior behavior. "shrink_to_fit"
 * slots binary-search the largest size in [minFontSize, fontSize] that fits;
 * callers render exactly the returned lines at the returned size, so a
 * passing fit can't re-wrap differently at render time.
 */
export async function resolveTemplatePlatformTextSlotLayout(
  manifest: TemplateBundleManifest,
  value: unknown,
  slot: TemplateBundleTextSlot,
  fontSource?: TemplatePlatformFontSource
): Promise<TemplatePlatformResolvedTextLayout> {
  const text = cleanText(value);
  const maxSize = slot.fontSize;
  if (!text) {
    return { lines: [], lineWidths: [], overlongWords: [], renderedHeight: 0, fontSize: maxSize, fits: true };
  }

  const atMax = await measureAtSize(manifest, slot, text, maxSize, fontSource);
  if (
    slot.fit !== "shrink_to_fit" ||
    !slot.minFontSize ||
    slot.minFontSize >= maxSize
  ) {
    return { ...atMax, fontSize: maxSize, fits: fitsLayout(atMax, slot) };
  }
  if (fitsLayout(atMax, slot)) {
    return { ...atMax, fontSize: maxSize, fits: true };
  }

  const minSize = slot.minFontSize;
  let low = minSize;
  let high = maxSize;
  let found: { fontSize: number; layout: TemplatePlatformTextLayout } | null = null;
  for (let step = 0; step < 18 && high - low > 0.25; step += 1) {
    const mid = (low + high) / 2;
    const layout = await measureAtSize(manifest, slot, text, mid, fontSource);
    if (fitsLayout(layout, slot)) {
      found = { fontSize: mid, layout };
      low = mid;
    } else {
      high = mid;
    }
  }
  if (found) {
    return { ...found.layout, fontSize: found.fontSize, fits: true };
  }

  const atMin = await measureAtSize(manifest, slot, text, minSize, fontSource);
  return { ...atMin, fontSize: minSize, fits: fitsLayout(atMin, slot) };
}

/** Resolves every text slot of a variant in one pass, keyed by field name. */
export async function resolveTemplatePlatformVariantLayout(
  input: {
    manifest: TemplateBundleManifest;
    variantKey: string;
    fields: Record<string, unknown>;
  } & TemplatePlatformFontSource
): Promise<Record<string, TemplatePlatformResolvedTextLayout>> {
  const entries = await Promise.all(
    textSlots(input.manifest, input.variantKey).map(async (slot) => {
      const resolved = await resolveTemplatePlatformTextSlotLayout(
        input.manifest,
        input.fields[slot.field],
        slot,
        { assetUrlByPath: input.assetUrlByPath, assetDataByPath: input.assetDataByPath }
      );
      return [slot.field, resolved] as const;
    })
  );
  return Object.fromEntries(entries);
}

export async function templatePlatformFieldFitIssues(
  input: {
    manifest: TemplateBundleManifest;
    variantKey: string;
    fields: Record<string, unknown>;
  } & TemplatePlatformFontSource
): Promise<Record<string, TemplatePlatformFitIssue[]>> {
  const entries = await Promise.all(
    textSlots(input.manifest, input.variantKey).map(async (slot) => {
      const layout = await resolveTemplatePlatformTextSlotLayout(
        input.manifest,
        input.fields[slot.field],
        slot,
        { assetUrlByPath: input.assetUrlByPath, assetDataByPath: input.assetDataByPath }
      );
      const issues: TemplatePlatformFitIssue[] = [];
      if (layout.overlongWords.length) {
        issues.push({
          field: slot.field,
          type: "width",
          message: `${slot.field.replace(/_/g, " ")} has a word too long for the text box.`,
        });
      }
      if (layout.lines.length > slot.maxLines) {
        issues.push({
          field: slot.field,
          type: "lines",
          message: `${slot.field.replace(/_/g, " ")} wraps to ${layout.lines.length} lines; maximum is ${slot.maxLines}.`,
        });
      }
      if (layout.renderedHeight > slot.height + 0.5) {
        issues.push({
          field: slot.field,
          type: "height",
          message: `${slot.field.replace(/_/g, " ")} is too tall for the text box.`,
        });
      }
      return [slot.field, issues] as const;
    })
  );

  return Object.fromEntries(entries.filter(([, issues]) => issues.length > 0));
}

export function formatTemplatePlatformFitIssues(
  issues: Record<string, TemplatePlatformFitIssue[]>
) {
  return Object.values(issues)
    .flat()
    .map((issue) => `${issue.field}: ${issue.message}`);
}

export function templatePlatformFitInstructions(input: {
  manifest: TemplateBundleManifest;
  variantKey: string;
}) {
  return textSlots(input.manifest, input.variantKey).map(
    (slot) =>
      `- ${slot.field}: ${templateBundleFontDescription(input.manifest, slot)} ${Number(slot.fontSize.toFixed(2))}px in a ${Number(slot.width.toFixed(2))}px-wide by ${Number(slot.height.toFixed(2))}px-tall box; maximum ${slot.maxLines} rendered line${slot.maxLines === 1 ? "" : "s"}`
  );
}

export async function coerceTemplatePlatformFieldsToFit(
  input: {
    manifest: TemplateBundleManifest;
    variantKey: string;
    fields: Record<string, string>;
  } & TemplatePlatformFontSource
): Promise<Record<string, string>> {
  const coerced = { ...input.fields };
  const fontSource: TemplatePlatformFontSource = {
    assetUrlByPath: input.assetUrlByPath,
    assetDataByPath: input.assetDataByPath,
  };

  for (const slot of textSlots(input.manifest, input.variantKey)) {
    let value = cleanText(coerced[slot.field]);
    if (!value) continue;
    if (slot.maxChars && value.length > slot.maxChars) {
      value = value.slice(0, slot.maxChars).trim();
    }

    for (let attempt = 0; attempt < 120; attempt += 1) {
      const layout = await resolveTemplatePlatformTextSlotLayout(input.manifest, value, slot, fontSource);
      if (layout.fits) break;

      const tooLongWord = layout.overlongWords[0];
      if (tooLongWord) {
        const replacement = tooLongWord.slice(0, Math.max(1, tooLongWord.length - 1));
        value = value.replace(tooLongWord, replacement).trim();
      } else {
        value = trimLastWord(value);
      }

      if (!value) break;
    }

    coerced[slot.field] = value;
  }

  return coerced;
}
