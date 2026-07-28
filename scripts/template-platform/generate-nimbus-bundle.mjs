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
const layoutsPath = join(sourceRoot, "figma-layouts.json");
const baseAssetRoot = join(sourceRoot, "base-assets");
const outputRoot = join(projectRoot, ".template-bundles", "nimbus-air-campaign");


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

// Nimbus was designed as one responsive Figma system, not 42 unrelated
// canvases. These values are the design-system equations used by the Figma
// frames (geometric-mean scale preserves both very wide and very tall
// formats). `figma-layouts.json`, when extracted, remains the authoritative
// recorded geometry; this fallback makes a missing extraction fail safe rather
// than silently reverting to the old crop-based layout.
function canonicalNimbusSlots(frame) {
  const scale = Math.sqrt(frame.width * frame.height) / 1080;
  const margin = frame.width / 36;
  const headlineSize = 120 * scale;
  const subheadSize = 42 * scale;
  const headlineLines = frame.height / frame.width >= 4 / 3 ? 2 : 1;
  const productWidth = 0.523 * Math.sqrt(frame.width * frame.height);
  const productHeight = productWidth / 1.17;
  const contentTop = frame.height / 24;
  return [
    { key: "product-slot", field: "__productVariantKey", kind: "image", x: (frame.width - productWidth) / 2 - frame.width * 0.076, y: (frame.height - productHeight) / 2, width: productWidth, height: productHeight, fit: "contain", focalPoint: { x: 0.5, y: 0.5 } },
    { key: "headline-slot", field: "headline", kind: "text", x: margin, y: contentTop, width: frame.width - margin * 2, height: headlineSize * 1.1 * headlineLines, fontKey: "dela-gothic-one-regular", fontSize: headlineSize, lineHeight: 1.1, letterSpacing: 0, color: "#000000", align: "center", verticalAlign: "center", maxChars: 24, maxLines: headlineLines, minFontSize: headlineSize * 0.58, fit: "shrink_to_fit" },
    { key: "subheadline-1-slot", field: "subheadline_1", kind: "text", x: margin, y: contentTop + headlineSize * (headlineLines === 1 ? 0.925 : 2.025), width: frame.width - margin * 2, height: subheadSize * 1.2, fontKey: "geist-mono-regular", fontSize: subheadSize, lineHeight: 1.2, letterSpacing: 0, color: "#000000", align: "center", verticalAlign: "bottom", maxChars: 40, maxLines: 1, minFontSize: subheadSize * 0.58, fit: "shrink_to_fit" },
    { key: "subheadline-2-slot", field: "subheadline_2", kind: "text", x: margin, y: frame.height * 0.5694444444, width: frame.width - margin * 2, height: subheadSize * 4.2857142857, fontKey: "geist-mono-regular", fontSize: subheadSize, lineHeight: 1.2, letterSpacing: 0, color: "#000000", align: "right", verticalAlign: "bottom", maxChars: 56, maxLines: 3, minFontSize: subheadSize * 0.58, fit: "shrink_to_fit" },
  ];
}

function bundleChannel(channel) {
  if (channel === "print" || channel === "card") return "document";
  if (channel === "youtube") return "display_ad";
  return "social";
}

async function main() {
  const source = JSON.parse(await readFile(framesPath, "utf8"));
  const extracted = await readFile(layoutsPath, "utf8")
    .then((value) => JSON.parse(value))
    .catch(() => ({ layouts: {} }));
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

  for (const productVariant of source.productVariants) {
    const productPath = join(baseAssetRoot, productVariant.asset);
    const productMeta = await sharp(productPath).metadata();
    const productHash = await copyAsset(
      productPath,
      join(outputRoot, "products", `${productVariant.key}.png`)
    );
    assets.push({
      key: `product-${productVariant.key}`,
      kind: "image",
      path: `products/${productVariant.key}.png`,
      sha256: productHash,
      width: productMeta.width,
      height: productMeta.height,
      mimeType: "image/png",
    });
  }

  const variants = [];
  for (const frame of source.frames) {
    const layout = extracted.layouts?.[frame.key];
    if (layout && (layout.width !== frame.width || layout.height !== frame.height)) {
      throw new Error(`Stale Figma layout for Nimbus frame ${frame.key}. Run template-platform:extract-nimbus-figma first.`);
    }
    const variantDir = join("variants", frame.key);
    const referencePath = join(variantDir, "reference.png");
    // Brand reference is never an approximation of another format. It is the
    // actual Figma export for this exact frame, so selecting a size is a cheap
    // static-image swap and cannot inherit another canvas's crop.
    // These are Figma frame exports at 2×, validated against each frame's
    // exact dimensions. They are intentionally not screenshots or raw source
    // layers; Studio serves this file directly for the Brand reference view.
    const referenceSource = join(sourceRoot, "figma-exports-2x", `${frame.key}.png`);
    const referenceHash = await copyAsset(
      referenceSource,
      join(outputRoot, referencePath)
    );
    const referenceMeta = await sharp(referenceSource).metadata();
    assets.push({
      key: `${frame.key}-reference`,
      kind: "reference",
      path: referencePath,
      sha256: referenceHash,
      width: referenceMeta.width,
      height: referenceMeta.height,
      mimeType: "image/png",
    });
    const backgroundOptions = [];
    for (const backgroundOption of source.backgroundOptions) {
      const backgroundPath = join(variantDir, "backgrounds", `${backgroundOption.key}.png`);
      const backgroundHash = await writeImage(
        join(baseAssetRoot, backgroundOption.asset),
        join(outputRoot, backgroundPath),
        frame.width,
        frame.height
      );
      const assetKey = `${frame.key}-${backgroundOption.key}-background`;
      assets.push({
        key: assetKey,
        kind: "background",
        path: backgroundPath,
        sha256: backgroundHash,
        width: frame.width,
        height: frame.height,
        mimeType: "image/png",
      });
      backgroundOptions.push({
        key: backgroundOption.key,
        label: backgroundOption.label,
        asset: assetKey,
      });
    }
    variants.push({
      key: frame.key,
      label: frame.label,
      channel: bundleChannel(frame.channel),
      width: frame.width,
      height: frame.height,
      sourceNodeId: frame.figmaNodeId,
      referenceAsset: `${frame.key}-reference`,
      backgroundAsset: `${frame.key}-${source.defaultBackgroundKey}-background`,
      backgroundOptions,
      slots: layout?.slots ?? canonicalNimbusSlots(frame),
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
      // A bundle version is immutable after import. Bump this whenever the
      // checked-in Figma reference exports or locked layout contract changes,
      // otherwise the importer correctly reuses stale storage assets.
      name: "figma-full-v7",
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
