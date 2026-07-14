import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import {
  resolvePublishedTemplatePackage,
  type PublishedTemplatePackage,
  type PublishedTextSlot,
} from "../published-template-package";
import {
  TEMPLATE_BUNDLE_SCHEMA_VERSION,
  type TemplateBundleAsset,
  type TemplateBundleField,
  type TemplateBundleFont,
  type TemplateBundleManifest,
  type TemplateBundleTextSlot,
  type TemplateBundleVariant,
} from "./manifest.ts";
import type { TemplateBundleAssetSource } from "./importer.ts";
import {
  getTemplateLayoutContract,
  TEMPLATE_OUTPUT_SIZES,
  type TemplateSizeKey,
} from "../template-contract";

const CONTENTGATE_FIGMA_FILE_KEY = "IpOSq5oAG87yAGBtpYqQvG";

const INTER_FONT_FILES: Array<{
  key: string;
  family: "Inter";
  weight: 400 | 500 | 600 | 700;
  path: string;
}> = [
  { key: "inter-regular", family: "Inter", weight: 400, path: "fonts/Inter-Regular.ttf" },
  { key: "inter-medium", family: "Inter", weight: 500, path: "fonts/Inter-Medium.ttf" },
  { key: "inter-semibold", family: "Inter", weight: 600, path: "fonts/Inter-SemiBold.ttf" },
  { key: "inter-bold", family: "Inter", weight: 700, path: "fonts/Inter-Bold.ttf" },
];

const FIELD_LABELS: Record<string, string> = {
  cta: "CTA",
  headline: "Headline",
  local_detail: "Local detail",
  proof_note: "Proof note",
  subheadline: "Subheadline",
};

const LAYOUT_FAMILY_KEYS: Record<string, string> = {
  contentgate_local_friendly: "contentgate-local-friendly",
  contentgate_local_premium: "contentgate-local-premium",
};

type PublishedFrame = NonNullable<PublishedTemplatePackage["frames"][TemplateSizeKey]>;

export type ContentGateTemplateBundle = {
  manifest: TemplateBundleManifest;
  assets: TemplateBundleAssetSource[];
};

function publicPathToBundlePath(path: string) {
  return path.replace(/^\//, "");
}

function publicPathToFilePath(path: string) {
  return join(process.cwd(), "public", publicPathToBundlePath(path));
}

function sha256(data: Uint8Array) {
  return createHash("sha256").update(data).digest("hex");
}

function contentTypeForPath(path: string) {
  switch (extname(path).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".ttf":
      return "font/ttf";
    default:
      return "application/octet-stream";
  }
}

function assetKey(...parts: string[]) {
  return parts
    .join("-")
    .replace(/_/g, "-")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function fontKeyForWeight(weight: number) {
  if (weight >= 650) return "inter-bold";
  if (weight >= 550) return "inter-semibold";
  if (weight >= 450) return "inter-medium";
  return "inter-regular";
}

function variantChannel(size: TemplateSizeKey): TemplateBundleVariant["channel"] {
  return size === "leaderboard" || size === "medium_rectangle" || size === "link_ad"
    ? "display_ad"
    : "social";
}

function toTextSlot(slot: PublishedTextSlot): TemplateBundleTextSlot {
  return {
    key: assetKey(slot.field, "slot"),
    field: slot.field,
    kind: "text",
    x: slot.x,
    y: slot.y,
    width: slot.w,
    height: slot.h,
    fontKey: fontKeyForWeight(slot.weight),
    fontSize: slot.fontSize,
    lineHeight: slot.lineHeight,
    letterSpacing: 0,
    color: slot.color,
    align: slot.align ?? "left",
    verticalAlign: slot.verticalAlign === "center" ? "middle" : slot.verticalAlign ?? "top",
    maxChars: slot.maxChars,
    maxLines: slot.maxLines,
    lineChars: slot.lineChars,
    minFontSize: Math.max(8, Math.floor(slot.fontSize * 0.72)),
    fit: "shrink_to_fit",
  };
}

function fieldsFromFrames(frames: PublishedFrame[]): TemplateBundleField[] {
  const fieldKeys = [
    ...new Set(frames.flatMap((frame) => frame.textSlots.map((slot) => slot.field))),
  ];
  return fieldKeys.map((key) => ({
    key,
    label: FIELD_LABELS[key] ?? key,
    type: "text",
    source: "ai",
    required: key === "headline" || key === "cta",
    localizable: true,
  }));
}

async function readBundleAsset(input: {
  key: string;
  kind: TemplateBundleAsset["kind"];
  path: string;
  width?: number;
  height?: number;
}): Promise<{
  asset: TemplateBundleAsset;
  source: TemplateBundleAssetSource;
}> {
  const data = await readFile(publicPathToFilePath(input.path));
  const bundlePath = publicPathToBundlePath(input.path);
  const contentType = contentTypeForPath(bundlePath);
  const checksum = sha256(data);

  return {
    asset: {
      key: input.key,
      kind: input.kind,
      path: bundlePath,
      sha256: checksum,
      width: input.width,
      height: input.height,
      mimeType: contentType,
    },
    source: {
      path: bundlePath,
      data,
      contentType,
    },
  };
}

async function buildFontAssets(): Promise<{
  assets: TemplateBundleAsset[];
  fonts: TemplateBundleFont[];
  sources: TemplateBundleAssetSource[];
}> {
  const entries = await Promise.all(
    INTER_FONT_FILES.map(async (font) => {
      const { asset, source } = await readBundleAsset({
        key: `${font.key}-file`,
        kind: "font",
        path: font.path,
      });
      return {
        asset,
        source,
        font: {
          key: font.key,
          family: font.family,
          style: "normal" as const,
          weight: font.weight,
          asset: asset.key,
          sha256: asset.sha256,
        },
      };
    })
  );

  return {
    assets: entries.map((entry) => entry.asset),
    fonts: entries.map((entry) => entry.font),
    sources: entries.map((entry) => entry.source),
  };
}

async function buildVariantAssets(input: {
  packageKey: string;
  size: TemplateSizeKey;
  frame: PublishedFrame;
}) {
  if (!input.frame.referenceImage || !input.frame.generatedImage) {
    throw new Error(`ContentGate ${input.packageKey}/${input.size} is missing Figma exports.`);
  }

  const dimensions = TEMPLATE_OUTPUT_SIZES[input.size];
  const [reference, background] = await Promise.all([
    readBundleAsset({
      key: assetKey(input.size, "reference"),
      kind: "reference",
      path: input.frame.referenceImage,
      width: dimensions.w,
      height: dimensions.h,
    }),
    readBundleAsset({
      key: assetKey(input.size, "background"),
      kind: "background",
      path: input.frame.generatedImage,
      width: dimensions.w,
      height: dimensions.h,
    }),
  ]);

  return {
    assets: [reference.asset, background.asset],
    sources: [reference.source, background.source],
    referenceKey: reference.asset.key,
    backgroundKey: background.asset.key,
  };
}

export async function buildContentGateTemplateBundle(
  layoutKey: "contentgate_local_friendly" | "contentgate_local_premium"
): Promise<ContentGateTemplateBundle> {
  const pkg = resolvePublishedTemplatePackage(layoutKey);
  if (!pkg) throw new Error(`Unknown ContentGate package ${layoutKey}.`);
  const contract = getTemplateLayoutContract(layoutKey);
  if (!contract) throw new Error(`Missing ContentGate contract ${layoutKey}.`);

  const familyKey = LAYOUT_FAMILY_KEYS[layoutKey];
  const frameEntries = contract.sizes.map((size) => {
    const frame = pkg.frames[size];
    if (!frame) throw new Error(`ContentGate ${layoutKey}/${size} has no frame.`);
    return [size, frame] as [TemplateSizeKey, PublishedFrame];
  });
  const fontAssets = await buildFontAssets();
  const variantAssetEntries = await Promise.all(
    frameEntries.map(([size, frame]) =>
      buildVariantAssets({ packageKey: pkg.packageKey, size, frame })
    )
  );

  const variants: TemplateBundleVariant[] = frameEntries.map(([size, frame], index) => {
    const dimensions = TEMPLATE_OUTPUT_SIZES[size];
    const variantAssets = variantAssetEntries[index];
    return {
      key: size,
      label: dimensions.label,
      channel: variantChannel(size),
      width: dimensions.w,
      height: dimensions.h,
      referenceAsset: variantAssets.referenceKey,
      backgroundAsset: variantAssets.backgroundKey,
      slots: frame.textSlots.map(toTextSlot),
    };
  });

  const frames = frameEntries.map(([, frame]) => frame);
  const manifest: TemplateBundleManifest = {
    schemaVersion: TEMPLATE_BUNDLE_SCHEMA_VERSION,
    family: {
      key: familyKey,
      name: pkg.publicName,
    },
    version: {
      name: "v1",
      source: "figma",
      sourceFileKey: CONTENTGATE_FIGMA_FILE_KEY,
      sourceVersion: pkg.packageKey,
    },
    fields: fieldsFromFrames(frames),
    fonts: fontAssets.fonts,
    assets: [
      ...fontAssets.assets,
      ...variantAssetEntries.flatMap((entry) => entry.assets),
    ],
    variants,
  };

  return {
    manifest,
    assets: [
      ...fontAssets.sources,
      ...variantAssetEntries.flatMap((entry) => entry.sources),
    ],
  };
}
