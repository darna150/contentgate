import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { Font, Glyph } from "opentype.js";

import {
  getPublishedTemplateFrameTextSlots,
  normalizePublishedTemplateText,
  type PublishedTextSlot,
} from "./published-template-package";
import type { TemplateSizeKey } from "./template-contract";

export type PublishedTemplateFitIssue = {
  field: string;
  type: "lines" | "width";
  message: string;
};

export type PublishedTextLayout = {
  lines: string[];
  lineWidths: number[];
  overlongWords: string[];
};

const FONT_FILE_BY_WEIGHT: Record<number, string> = {
  400: "Inter-Regular.ttf",
  500: "Inter-Medium.ttf",
  600: "Inter-SemiBold.ttf",
  700: "Inter-Bold.ttf",
};
const require = createRequire(import.meta.url);
const { parse: parseFont } = require("opentype.js") as {
  parse: (buffer: ArrayBuffer) => Font;
};

const fontPromises = new Map<number, Promise<Font>>();

function supportedWeight(weight: number) {
  if (weight >= 650) return 700;
  if (weight >= 550) return 600;
  if (weight >= 450) return 500;
  return 400;
}

function styleName(weight: number) {
  if (weight >= 650) return "Bold";
  if (weight >= 550) return "Semi Bold";
  if (weight >= 450) return "Medium";
  return "Regular";
}

async function loadInterFont(weight: number): Promise<Font> {
  const resolvedWeight = supportedWeight(weight);
  let promise = fontPromises.get(resolvedWeight);
  if (!promise) {
    promise = readFile(
      join(
        process.cwd(),
        "public",
        "fonts",
        FONT_FILE_BY_WEIGHT[resolvedWeight]
      )
    ).then((buffer) =>
      parseFont(
        buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength
        ) as ArrayBuffer
      )
    );
    fontPromises.set(resolvedWeight, promise);
  }
  return promise;
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

export async function measurePublishedTextSlot(
  value: unknown,
  slot: PublishedTextSlot
): Promise<PublishedTextLayout> {
  const text = normalizePublishedTemplateText(value);
  if (!text) return { lines: [], lineWidths: [], overlongWords: [] };

  const font = await loadInterFont(slot.weight);
  const measure = (line: string) => glyphWidth(font, line, slot.fontSize);
  const lines: string[] = [];
  const overlongWords = new Set<string>();

  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let current = "";

    for (const word of words) {
      if (measure(word) > slot.w) overlongWords.add(word);
      const candidate = current ? `${current} ${word}` : word;
      if (!current || measure(candidate) <= slot.w) {
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
  };
}

export async function publishedTemplateFieldFitIssues(input: {
  layoutKey: string;
  sizeKey: TemplateSizeKey;
  fields: Record<string, unknown>;
  definition?: unknown;
}): Promise<Record<string, PublishedTemplateFitIssue[]>> {
  const slots = getPublishedTemplateFrameTextSlots(
    input.layoutKey,
    input.sizeKey,
    input.definition
  );
  if (!slots) return {};

  const entries = await Promise.all(
    slots.map(async (slot) => {
      const layout = await measurePublishedTextSlot(input.fields[slot.field], slot);
      const issues: PublishedTemplateFitIssue[] = [];
      if (layout.overlongWords.length) {
        issues.push({
          field: slot.field,
          type: "width",
          message: `contains text wider than its ${Math.round(slot.w)}px box`,
        });
      }
      if (layout.lines.length > slot.maxLines) {
        issues.push({
          field: slot.field,
          type: "lines",
          message: `renders as ${layout.lines.length} lines; maximum ${slot.maxLines} at Inter ${styleName(slot.weight)} ${Number(slot.fontSize.toFixed(2))}px`,
        });
      }
      return [slot.field, issues] as const;
    })
  );

  return Object.fromEntries(entries.filter(([, issues]) => issues.length));
}

export function publishedTemplateFitInstructions(input: {
  layoutKey: string;
  sizeKey: TemplateSizeKey;
  definition?: unknown;
}) {
  const slots = getPublishedTemplateFrameTextSlots(
    input.layoutKey,
    input.sizeKey,
    input.definition
  );
  if (!slots) return [];
  return slots.map(
    (slot) =>
      `- ${slot.field}: Inter ${styleName(slot.weight)} ${Number(slot.fontSize.toFixed(2))}px in a ${Number(slot.w.toFixed(2))}px-wide box; maximum ${slot.maxLines} rendered line${slot.maxLines === 1 ? "" : "s"}`
  );
}

export function formatPublishedTemplateFitIssues(
  issues: Record<string, PublishedTemplateFitIssue[]>
) {
  return Object.values(issues)
    .flat()
    .map((issue) => `${issue.field}: ${issue.message}`);
}

function trimLastWord(value: string) {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return value.slice(0, Math.max(0, value.length - 1)).trim();
  return words.slice(0, -1).join(" ").trim();
}

export async function coercePublishedTemplateFieldsToFit(input: {
  layoutKey: string;
  sizeKey: TemplateSizeKey;
  fields: Record<string, string>;
  definition?: unknown;
}): Promise<Record<string, string>> {
  const slots = getPublishedTemplateFrameTextSlots(
    input.layoutKey,
    input.sizeKey,
    input.definition
  );
  if (!slots) return input.fields;

  const coerced = { ...input.fields };

  for (const slot of slots) {
    let value = normalizePublishedTemplateText(coerced[slot.field]);
    if (!value) continue;
    if (value.length > slot.maxChars) value = value.slice(0, slot.maxChars).trim();

    for (let attempt = 0; attempt < 120; attempt += 1) {
      const layout = await measurePublishedTextSlot(value, slot);
      const fits =
        layout.overlongWords.length === 0 && layout.lines.length <= slot.maxLines;
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
