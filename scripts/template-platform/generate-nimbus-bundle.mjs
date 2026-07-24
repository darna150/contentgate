#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDir, "..", "..");
const sourceRoot = join(projectRoot, "template-sources", "nimbus-air-campaign");
const framesPath = join(sourceRoot, "frames.json");
const baseAssetRoot = join(sourceRoot, "base-assets");
const outputRoot = join(projectRoot, ".template-bundles", "nimbus-air-campaign");

const baseReferencePath = join(baseAssetRoot, "reference.png");
const baseBackgroundPath = join(baseAssetRoot, "background.png");
const baseProductPath = join(baseAssetRoot, "nimbus-1.png");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function writeImage(inputPath, outputPath, width, height) {
  await mkdir(dirname(outputPath), { recursive: true });
  const buffer = await sharp(inputPath)
    .resize(width, height, { fit: "cover", position: "center" })
    .png()
    .toBuffer();
  await writeFile(outputPath, buffer);
  return sha256(buffer);
}

async function copyAsset(inputPath, outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await copyFile(inputPath, outputPath);
  return sha256(await readFile(outputPath));
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function fontSizeFor(width, height, base, min, max) {
  const scale = Math.min(width / 1080, height / 1080);
  return Math.max(min, Math.min(max, Math.round(base * scale)));
}

function variantSlots(frame) {
  const { width, height } = frame;
  const margin = round(Math.max(8, width / 36));
  const contentWidth = round(width - margin * 2);
  const aspect = width / height;

  let productHeight;
  let productWidth;
  if (aspect >= 1.6) {
    productHeight = height * 0.62;
    productWidth = productHeight * 1.17;
  } else if (aspect <= 0.7) {
    productWidth = width * 0.7;
    productHeight = productWidth / 1.17;
  } else {
    productWidth = width * 0.523;
    productHeight = productWidth / 1.17;
  }
  productWidth = Math.min(productWidth, width * 0.72);
  productHeight = Math.min(productHeight, height * 0.48);
  const productX = round((width - productWidth) / 2 - width * 0.075);
  const productY = round(height * 0.277);

  const compact = height <= 144 || width <= 320;
  const short = height <= 400;
  const bannerLike = height <= 320 && aspect >= 2;
  const headlineSize = fontSizeFor(width, height, compact ? 42 : 120, compact ? 8 : 24, compact ? 22 : 120);
  const subheadSize = fontSizeFor(width, height, compact ? 15 : 42, compact ? 5 : 12, compact ? 12 : 42);
  const headlineMaxLines = aspect < 0.8 || width < 700 ? 2 : 1;
  const headlineHeight = round(headlineSize * 1.12 * headlineMaxLines + headlineSize * 0.16);
  const subheadline1Height = round(subheadSize * 1.25 + subheadSize * 0.12);
  const contentTop = round(short ? height * 0.045 : height * 0.0417);
  const subheadline2Height = round(Math.max(subheadSize * 1.35, height * (compact ? 0.22 : 0.16)));
  const subheadline2Top = round(height * (compact ? 0.57 : 0.555));

  return [
    {
      key: "product-slot",
      field: "__productVariantKey",
      kind: "image",
      x: Math.max(0, round(productX)),
      y: Math.max(0, round(productY)),
      width: round(productWidth),
      height: round(productHeight),
      fit: "contain",
      focalPoint: { x: 0.5, y: 0.5 },
    },
    {
      key: "headline-slot",
      field: "headline",
      kind: "text",
      x: margin,
      y: contentTop,
      width: contentWidth,
      height: headlineHeight,
      fontKey: "dela-gothic-one-regular",
      fontSize: headlineSize,
      lineHeight: 1.1,
      letterSpacing: 0,
      color: "#000000",
      align: "center",
      verticalAlign: "top",
      maxChars: compact ? 18 : 24,
      maxLines: headlineMaxLines,
      minFontSize: Math.max(5, Math.round(headlineSize * 0.48)),
      fit: "shrink_to_fit",
    },
    {
      key: "subheadline-1-slot",
      field: "subheadline_1",
      kind: "text",
      x: margin,
      y: round(contentTop + headlineHeight + Math.max(4, height * 0.022)),
      width: contentWidth,
      height: subheadline1Height,
      fontKey: "geist-mono-regular",
      fontSize: subheadSize,
      lineHeight: 1.2,
      letterSpacing: 0,
      color: "#000000",
      align: "center",
      verticalAlign: "top",
      maxChars: compact ? 24 : 40,
      maxLines: 1,
      minFontSize: Math.max(5, Math.round(subheadSize * 0.58)),
      fit: "shrink_to_fit",
    },
    {
      key: "subheadline-2-slot",
      field: "subheadline_2",
      kind: "text",
      x: margin,
      y: subheadline2Top,
      width: contentWidth,
      height: subheadline2Height,
      fontKey: "geist-mono-regular",
      fontSize: subheadSize,
      lineHeight: 1.2,
      letterSpacing: 0,
      color: "#000000",
      align: "right",
      verticalAlign: "bottom",
      maxChars: compact ? 32 : 56,
      maxLines: compact || bannerLike ? 2 : 3,
      minFontSize: Math.max(5, Math.round(subheadSize * 0.58)),
      fit: "shrink_to_fit",
    },
  ];
}

function bundleChannel(channel) {
  if (channel === "print" || channel === "card") return "document";
  if (channel === "youtube") return "display_ad";
  return "social";
}

async function main() {
  const source = JSON.parse(await readFile(framesPath, "utf8"));
  await mkdir(outputRoot, { recursive: true });

  const fontAssets = [
    {
      key: "dela-gothic-one-regular-file",
      kind: "font",
      path: "fonts/DelaGothicOne-Regular.ttf",
      mimeType: "font/ttf",
      source: "DelaGothicOne-Regular.ttf",
    },
    {
      key: "geist-mono-regular-file",
      kind: "font",
      path: "fonts/GeistMono-Regular.ttf",
      mimeType: "font/ttf",
      source: "GeistMono-Regular.ttf",
    },
    {
      key: "inter-medium-file",
      kind: "font",
      path: "fonts/Inter-Medium.ttf",
      mimeType: "font/ttf",
      source: "Inter-Medium.ttf",
    },
  ];

  const assets = [];
  for (const asset of fontAssets) {
    const hash = await copyAsset(join(baseAssetRoot, asset.source), join(outputRoot, asset.path));
    assets.push({ key: asset.key, kind: asset.kind, path: asset.path, sha256: hash, mimeType: asset.mimeType });
  }

  const productMeta = await sharp(baseProductPath).metadata();
  const productHash = await copyAsset(baseProductPath, join(outputRoot, "products", "nimbus-1.png"));
  assets.push({
    key: "product-nimbus-1",
    kind: "image",
    path: "products/nimbus-1.png",
    sha256: productHash,
    width: productMeta.width,
    height: productMeta.height,
    mimeType: "image/png",
  });

  const variants = [];
  for (const frame of source.frames) {
    const variantDir = join("variants", frame.key);
    const referencePath = join(variantDir, "reference.png");
    const backgroundPath = join(variantDir, "background.png");
    const referenceHash = await writeImage(
      baseReferencePath,
      join(outputRoot, referencePath),
      frame.width,
      frame.height
    );
    const backgroundHash = await writeImage(
      baseBackgroundPath,
      join(outputRoot, backgroundPath),
      frame.width,
      frame.height
    );
    assets.push({
      key: `${frame.key}-reference`,
      kind: "reference",
      path: referencePath,
      sha256: referenceHash,
      width: frame.width,
      height: frame.height,
      mimeType: "image/png",
    });
    assets.push({
      key: `${frame.key}-background`,
      kind: "background",
      path: backgroundPath,
      sha256: backgroundHash,
      width: frame.width,
      height: frame.height,
      mimeType: "image/png",
    });
    variants.push({
      key: frame.key,
      label: frame.label,
      channel: bundleChannel(frame.channel),
      width: frame.width,
      height: frame.height,
      sourceNodeId: frame.figmaNodeId,
      referenceAsset: `${frame.key}-reference`,
      backgroundAsset: `${frame.key}-background`,
      backgroundOptions: source.backgroundOptions.map((option) => ({
        key: option.key,
        label: option.label,
        asset: `${frame.key}-background`,
      })),
      slots: variantSlots(frame),
    });
  }

  const fontHashByKey = new Map(assets.filter((asset) => asset.kind === "font").map((asset) => [asset.key, asset.sha256]));
  const manifest = {
    schemaVersion: "template-bundle-v1",
    family: {
      key: "nimbus-air-campaign",
      name: "Nimbus Air Campaign",
      description:
        "Nimbus 1 running-shoe campaign templates. Locked sky/product design with editable, governed copy; swappable product and background pickers.",
    },
    version: {
      name: "figma-full-v1",
      source: "figma",
      sourceFileKey: source.sourceFileKey,
      sourcePageNodeId: source.sourcePageNodeId,
    },
    fields: [
      { key: "headline", label: "Headline", type: "text", source: "ai", required: true, localizable: true },
      { key: "subheadline_1", label: "Subheadline 1", type: "text", source: "ai", required: true, localizable: true },
      { key: "subheadline_2", label: "Subheadline 2", type: "text", source: "ai", required: false, localizable: true },
      {
        key: "__backgroundAssetKey",
        label: "Background",
        type: "asset_choice",
        source: "user",
        required: false,
        options: source.backgroundOptions.map((option) => option.key),
        defaultValue: source.defaultBackgroundKey,
      },
      {
        key: "__productVariantKey",
        label: "Product variant",
        type: "asset_choice",
        source: "user",
        required: false,
        options: source.productVariants.map((option) => option.key),
        defaultValue: source.defaultProductVariantKey,
      },
    ],
    fonts: [
      {
        key: "dela-gothic-one-regular",
        family: "Dela Gothic One",
        style: "normal",
        weight: 400,
        asset: "dela-gothic-one-regular-file",
        sha256: fontHashByKey.get("dela-gothic-one-regular-file"),
      },
      {
        key: "geist-mono-regular",
        family: "Geist Mono",
        style: "normal",
        weight: 400,
        asset: "geist-mono-regular-file",
        sha256: fontHashByKey.get("geist-mono-regular-file"),
      },
      {
        key: "inter-medium",
        family: "Inter",
        style: "normal",
        weight: 500,
        asset: "inter-medium-file",
        sha256: fontHashByKey.get("inter-medium-file"),
      },
    ],
    assets,
    variants,
  };

  await writeFile(join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${variants.length} Nimbus variants to ${outputRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
