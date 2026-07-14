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

const fontPromises = new Map<string, Promise<Font>>();
const parseFont =
  opentype.parse ??
  (opentype as typeof opentype & { default?: { parse?: typeof opentype.parse } })
    .default?.parse;

async function loadTemplateFont(
  manifest: TemplateBundleManifest,
  slot: TemplateBundleTextSlot
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
      const data = await loadTemplateBundleFontData({ manifest, font });
      if (!data) {
        throw new Error(`Font asset for "${font.key}" could not be loaded.`);
      }
      return parseFont!(data);
    })();
    fontPromises.set(cacheKey, promise);
  }
  return promise;
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function glyphWidth(font: Font, text: string, fontSize: number) {
  const glyphs = Array.from(text).map((character) => font.charToGlyph(character));
  let units = 0;
  for (let index = 0; index < glyphs.length; index += 1) {
    const glyph = glyphs[index];
    units += glyph.advanceWidth ?? 0;
    const nextGlyph: Glyph | undefined = glyphs[index + 1];
    if (nextGlyph) units += font.getKerningValue(glyph, nextGlyph);
  }
  return (units / font.unitsPerEm) * fontSize;
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

export async function measureTemplatePlatformTextSlot(
  manifest: TemplateBundleManifest,
  value: unknown,
  slot: TemplateBundleTextSlot
): Promise<TemplatePlatformTextLayout> {
  const text = cleanText(value);
  if (!text) {
    return { lines: [], lineWidths: [], overlongWords: [], renderedHeight: 0 };
  }

  const font = await loadTemplateFont(manifest, slot);
  const measure = (line: string) => glyphWidth(font, line, slot.fontSize);
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
    renderedHeight: lines.length * slot.fontSize * slot.lineHeight,
  };
}

export async function templatePlatformFieldFitIssues(input: {
  manifest: TemplateBundleManifest;
  variantKey: string;
  fields: Record<string, unknown>;
}): Promise<Record<string, TemplatePlatformFitIssue[]>> {
  const entries = await Promise.all(
    textSlots(input.manifest, input.variantKey).map(async (slot) => {
      const layout = await measureTemplatePlatformTextSlot(
        input.manifest,
        input.fields[slot.field],
        slot
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

export async function coerceTemplatePlatformFieldsToFit(input: {
  manifest: TemplateBundleManifest;
  variantKey: string;
  fields: Record<string, string>;
}): Promise<Record<string, string>> {
  const coerced = { ...input.fields };

  for (const slot of textSlots(input.manifest, input.variantKey)) {
    let value = cleanText(coerced[slot.field]);
    if (!value) continue;
    if (slot.maxChars && value.length > slot.maxChars) {
      value = value.slice(0, slot.maxChars).trim();
    }

    for (let attempt = 0; attempt < 120; attempt += 1) {
      const layout = await measureTemplatePlatformTextSlot(input.manifest, value, slot);
      const fits =
        layout.overlongWords.length === 0 &&
        layout.lines.length <= slot.maxLines &&
        layout.renderedHeight <= slot.height + 0.5;
      if (fits) break;

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
