import { createHash } from "node:crypto";

import {
  TEMPLATE_BUNDLE_SCHEMA_VERSION,
  type TemplateBundleAsset,
  type TemplateBundleField,
  type TemplateBundleFont,
  type TemplateBundleManifest,
  type TemplateBundleSlot,
  type TemplateBundleTextSlot,
  type TemplateBundleVariant,
} from "./manifest.ts";

export const FIGMA_PUBLISHER_SCHEMA_VERSION = "figma-publisher-v1" as const;

export type FigmaPublisherLayer = {
  id: string;
  name: string;
  kind: "image" | "text";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  text?: string;
  fontFamily?: string;
  fontStyle?: "italic" | "normal";
  fontWeight?: number;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  color?: string;
  align?: "left" | "center" | "right";
  verticalAlign?: "bottom" | "middle" | "top";
};

export type FigmaPublisherFrame = {
  key: string;
  label: string;
  channel: TemplateBundleVariant["channel"];
  nodeId: string;
  width: number;
  height: number;
  referenceAssetPath: string;
  backgroundAssetPath: string;
  backgroundOptions?: Array<{
    key: string;
    label: string;
    assetPath: string;
    thumbnailAssetPath?: string;
  }>;
  layers: FigmaPublisherLayer[];
};

export type FigmaPublisherFontAsset = {
  family: string;
  style?: "italic" | "normal";
  weight: number;
  path: string;
  sourcePath?: string;
  sha256: string;
};

export type FigmaPublisherAssetMetadata = {
  path: string;
  sourcePath?: string;
  sha256: string;
  width?: number;
  height?: number;
  mimeType?: string;
};

export type FigmaPublisherInput = {
  schemaVersion: typeof FIGMA_PUBLISHER_SCHEMA_VERSION;
  family: {
    key: string;
    name: string;
    description?: string;
  };
  version: {
    name: string;
    sourceFileKey: string;
    sourceVersion?: string;
  };
  fonts: FigmaPublisherFontAsset[];
  frames: FigmaPublisherFrame[];
  assets?: FigmaPublisherAssetMetadata[];
};

export type FigmaPublisherIssue = {
  path: string;
  message: string;
};

export type FigmaPublisherResult =
  | { ok: true; manifest: TemplateBundleManifest }
  | { ok: false; issues: FigmaPublisherIssue[] };

type LayerAnnotation = {
  field?: string;
  label?: string;
  maxChars?: number;
  maxWords?: number;
  maxLines?: number;
  minFontSize?: number;
  source?: TemplateBundleField["source"];
  type?: TemplateBundleField["type"];
};

function keyPart(value: string) {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function fontWeightName(weight: number) {
  if (weight >= 800) return "extrabold";
  if (weight >= 700) return "bold";
  if (weight >= 600) return "semibold";
  if (weight >= 500) return "medium";
  if (weight >= 300) return "regular";
  return "light";
}

function fontKey(font: { family: string; style?: string; weight: number }) {
  return keyPart(
    [
      font.family,
      fontWeightName(font.weight),
      font.style === "italic" ? "italic" : "",
    ]
      .filter(Boolean)
      .join("-")
  );
}

function assetKey(path: string, suffix: string) {
  return keyPart(`${path}-${suffix}`);
}

function mimeType(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".ttf")) return "font/ttf";
  if (lower.endsWith(".otf")) return "font/otf";
  if (lower.endsWith(".woff")) return "font/woff";
  if (lower.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

function parseAnnotation(name: string): LayerAnnotation {
  const bracketed = name.match(/\[(cg(?::|\s)[^\]]+)\]/i)?.[1];
  const annotation = (bracketed ?? name)
    .replace(/^.*?\bcg(?::|\s)/i, "")
    .trim();
  const pairs = [...annotation.matchAll(/(?:^|[;\s])([a-zA-Z][\w-]*)=("[^"]*"|'[^']*'|[^;\s]+)/g)];
  const values = Object.fromEntries(
    pairs.map(([, rawKey, rawValue]) => [
      rawKey,
      rawValue.replace(/^["']|["']$/g, ""),
    ])
  );

  return {
    field: values.field,
    label: values.label,
    maxChars: values.maxChars ? Number(values.maxChars) : undefined,
    maxWords: values.maxWords ? Number(values.maxWords) : undefined,
    maxLines: values.maxLines ? Number(values.maxLines) : undefined,
    minFontSize: values.minFontSize ? Number(values.minFontSize) : undefined,
    source: values.source as TemplateBundleField["source"] | undefined,
    type: values.type as TemplateBundleField["type"] | undefined,
  };
}

function fieldLabel(field: string, annotation: LayerAnnotation) {
  return annotation.label ?? field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferredFieldType(layer: FigmaPublisherLayer, annotation: LayerAnnotation): TemplateBundleField["type"] {
  if (annotation.type) return annotation.type;
  return layer.kind === "image" ? "image" : "text";
}

function dedupeByKey<T extends { key: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.key, item])).values()];
}

function metadataFor(input: FigmaPublisherInput, path: string) {
  return input.assets?.find((asset) => asset.path === path);
}

function imageAsset(input: FigmaPublisherInput, path: string, kind: "background" | "reference", frame: FigmaPublisherFrame, issues: FigmaPublisherIssue[], issuePath: string): TemplateBundleAsset {
  const metadata = metadataFor(input, path);
  if (!metadata) {
    issues.push({
      path: issuePath,
      message: `Asset metadata is required for "${path}" so dimensions and checksum can be verified before publishing.`,
    });
  }
  if (metadata && (!metadata.width || !metadata.height)) {
    issues.push({
      path: issuePath,
      message: `Image asset "${path}" must include exported width and height.`,
    });
  }
  return {
    key: assetKey(path, kind),
    kind,
    path,
    sha256: metadata?.sha256 ?? createHash("sha256").update(path).digest("hex"),
    width: metadata?.width ?? frame.width,
    height: metadata?.height ?? frame.height,
    mimeType: metadata?.mimeType ?? mimeType(path),
  };
}

function fieldConflict(
  existing: TemplateBundleField,
  next: TemplateBundleField
) {
  if (existing.type !== next.type) return `type "${existing.type}" vs "${next.type}"`;
  if (existing.source !== next.source) return `source "${existing.source}" vs "${next.source}"`;
  if (existing.localizable !== next.localizable) return "localizable flag mismatch";
  return null;
}

function upsertField(
  fields: TemplateBundleField[],
  next: TemplateBundleField,
  issues: FigmaPublisherIssue[],
  path: string
) {
  const existing = fields.find((field) => field.key === next.key);
  if (!existing) {
    fields.push(next);
    return;
  }
  const conflict = fieldConflict(existing, next);
  if (conflict) {
    issues.push({
      path,
      message: `Field "${next.key}" has conflicting annotations (${conflict}).`,
    });
  }
}

function buildTextSlot(layer: FigmaPublisherLayer, annotation: LayerAnnotation): TemplateBundleTextSlot {
  if (!annotation.field) throw new Error(`Layer ${layer.id} is missing cg:field.`);
  return {
    key: keyPart(`${annotation.field}-${layer.id}`),
    field: annotation.field,
    kind: "text",
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    rotation: layer.rotation,
    fontKey: fontKey({
      family: layer.fontFamily ?? "Inter",
      style: layer.fontStyle ?? "normal",
      weight: layer.fontWeight ?? 400,
    }),
    fontSize: layer.fontSize ?? 16,
    lineHeight: layer.lineHeight ?? 1.1,
    letterSpacing: layer.letterSpacing,
    color: layer.color ?? "#000000",
    align: layer.align ?? "left",
    verticalAlign: layer.verticalAlign ?? "top",
    maxChars: annotation.maxChars,
    maxWords: annotation.maxWords,
    maxLines: annotation.maxLines ?? 1,
    minFontSize: annotation.minFontSize,
    fit: annotation.minFontSize ? "shrink_to_fit" : "fixed",
  };
}

function buildSlot(layer: FigmaPublisherLayer): TemplateBundleSlot | null {
  const annotation = parseAnnotation(layer.name);
  if (!annotation.field) return null;
  if (layer.kind === "text") return buildTextSlot(layer, annotation);
  return {
    key: keyPart(`${annotation.field}-${layer.id}`),
    field: annotation.field,
    kind: "image",
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    rotation: layer.rotation,
    fit: "cover",
  };
}

export function compileFigmaPublisherInput(input: FigmaPublisherInput): FigmaPublisherResult {
  const issues: FigmaPublisherIssue[] = [];
  if (input.schemaVersion !== FIGMA_PUBLISHER_SCHEMA_VERSION) {
    issues.push({ path: "schemaVersion", message: `Must be ${FIGMA_PUBLISHER_SCHEMA_VERSION}.` });
  }
  if (!input.frames.length) issues.push({ path: "frames", message: "At least one frame is required." });
  if (!input.fonts.length) issues.push({ path: "fonts", message: "At least one font asset is required." });

  const fields: TemplateBundleField[] = [];
  const variants: TemplateBundleVariant[] = [];
  const assets: TemplateBundleAsset[] = [];
  const declaredFontKeys = new Set(input.fonts.map((font) => fontKey(font)));

  const fonts: TemplateBundleFont[] = input.fonts.map((font) => {
    const key = fontKey(font);
    assets.push({
      key: `${key}-file`,
      kind: "font",
      path: font.path,
      sha256: font.sha256,
      mimeType: mimeType(font.path),
    });
    return {
      key,
      family: font.family,
      style: font.style ?? "normal",
      weight: font.weight,
      asset: `${key}-file`,
      sha256: font.sha256,
    };
  });

  for (const [frameIndex, frame] of input.frames.entries()) {
    if (frame.referenceAssetPath === frame.backgroundAssetPath) {
      issues.push({
        path: `frames.${frameIndex}.backgroundAssetPath`,
        message: "Generated mode requires a separate text-free background export, not the full reference image.",
      });
    }

    const slots = frame.layers.flatMap((layer, layerIndex) => {
      try {
        const slot = buildSlot(layer);
        if (!slot) return [];
        const annotation = parseAnnotation(layer.name);
        upsertField(
          fields,
          {
            key: slot.field,
            label: fieldLabel(slot.field, annotation),
            type: inferredFieldType(layer, annotation),
            source: annotation.source ?? "ai",
            required: layer.kind === "text",
            localizable: layer.kind === "text",
          },
          issues,
          `frames.${frameIndex}.layers.${layerIndex}.name`
        );
        if (slot.kind === "text" && !declaredFontKeys.has(slot.fontKey)) {
          issues.push({
            path: `frames.${frameIndex}.layers.${layerIndex}.fontFamily`,
            message: `Layer "${layer.name}" uses font "${slot.fontKey}" but no matching font asset was declared.`,
          });
        }
        return [slot];
      } catch (error) {
        issues.push({
          path: `frames.${frameIndex}.layers.${layer.id}`,
          message: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    });

    const reference = imageAsset(
      input,
      frame.referenceAssetPath,
      "reference",
      frame,
      issues,
      `frames.${frameIndex}.referenceAssetPath`
    );
    const background = imageAsset(
      input,
      frame.backgroundAssetPath,
      "background",
      frame,
      issues,
      `frames.${frameIndex}.backgroundAssetPath`
    );
    const backgroundOptions =
      frame.backgroundOptions?.map((option, optionIndex) => {
        const optionAsset = imageAsset(
          input,
          option.assetPath,
          "background",
          frame,
          issues,
          `frames.${frameIndex}.backgroundOptions.${optionIndex}.assetPath`
        );
        assets.push(optionAsset);
        return {
          key: option.key,
          label: option.label,
          asset: optionAsset.key,
        };
      }) ?? [];
    assets.push(reference, background);
    variants.push({
      key: frame.key,
      label: frame.label,
      channel: frame.channel,
      width: frame.width,
      height: frame.height,
      referenceAsset: reference.key,
      backgroundAsset: background.key,
      backgroundOptions: backgroundOptions.length ? backgroundOptions : undefined,
      slots,
    });
  }

  if (issues.length) return { ok: false, issues };

  return {
    ok: true,
    manifest: {
      schemaVersion: TEMPLATE_BUNDLE_SCHEMA_VERSION,
      family: input.family,
      version: {
        name: input.version.name,
        source: "figma",
        sourceFileKey: input.version.sourceFileKey,
        sourceVersion: input.version.sourceVersion,
      },
      fields: dedupeByKey(fields),
      fonts,
      assets: dedupeByKey(assets),
      variants,
    },
  };
}
