import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";

const PUBLIC_BUNDLE_ROOT = join(process.cwd(), "public", "template-bundles");

const EXPECTED_VARIANTS = {
  "contentgate-local-friendly": {
    leaderboard: [1456, 180],
    link_ad: [2400, 1256],
    medium_rectangle: [600, 500],
    square: [2160, 2160],
    story: [2160, 3840],
  },
  "contentgate-local-premium": {
    link_ad: [2400, 1256],
    medium_rectangle: [600, 500],
    portrait: [2160, 2700],
    square: [2160, 2160],
    story: [2160, 3840],
  },
} as const;

type ImageData = {
  data: Buffer;
  width: number;
  height: number;
  channels: number;
};

async function loadImage(path: string): Promise<ImageData> {
  const image = await sharp(await readFile(path))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: image.data,
    width: image.info.width,
    height: image.info.height,
    channels: image.info.channels,
  };
}

function isMeaningfulLockedPixel(data: Buffer, index: number) {
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  const alpha = data[index + 3];
  if (alpha < 245) return false;

  const isNearWhite = r > 238 && g > 238 && b > 238;
  const isNearCanvasCream =
    Math.abs(r - 248) < 10 && Math.abs(g - 244) < 12 && Math.abs(b - 236) < 14;
  const isNearWarmBackground =
    Math.abs(r - 246) < 12 && Math.abs(g - 240) < 14 && Math.abs(b - 228) < 18;
  return !isNearWhite && !isNearCanvasCream && !isNearWarmBackground;
}

function similarPixelsInVisualRegion(reference: ImageData, background: ImageData) {
  assert.equal(background.width, reference.width);
  assert.equal(background.height, reference.height);
  assert.equal(background.channels, reference.channels);

  let matchingLockedPixels = 0;
  const startX = Math.floor(reference.width * 0.42);
  for (let y = 0; y < reference.height; y += 1) {
    for (let x = startX; x < reference.width; x += 1) {
      const index = (y * reference.width + x) * reference.channels;
      if (!isMeaningfulLockedPixel(reference.data, index)) continue;
      const delta =
        Math.abs(reference.data[index] - background.data[index]) +
        Math.abs(reference.data[index + 1] - background.data[index + 1]) +
        Math.abs(reference.data[index + 2] - background.data[index + 2]);
      if (delta <= 36) matchingLockedPixels += 1;
    }
  }
  return matchingLockedPixels;
}

function isRustAccentPixel(data: Buffer, index: number) {
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  const alpha = data[index + 3];
  return alpha > 0 && r > 140 && r < 230 && g > 50 && g < 140 && b < 120;
}

function retainedTopRustAccentPixels(reference: ImageData, background: ImageData) {
  assert.equal(background.width, reference.width);
  assert.equal(background.height, reference.height);
  assert.equal(background.channels, reference.channels);

  const topRows = Math.max(1, Math.round(reference.height * 0.12));
  let referenceRustPixels = 0;
  let retainedRustPixels = 0;
  for (let y = 0; y < topRows; y += 1) {
    for (let x = 0; x < reference.width; x += 1) {
      const index = (y * reference.width + x) * reference.channels;
      if (!isRustAccentPixel(reference.data, index)) continue;
      referenceRustPixels += 1;
      const delta =
        Math.abs(reference.data[index] - background.data[index]) +
        Math.abs(reference.data[index + 1] - background.data[index + 1]) +
        Math.abs(reference.data[index + 2] - background.data[index + 2]);
      if (delta <= 24) retainedRustPixels += 1;
    }
  }
  return { referenceRustPixels, retainedRustPixels };
}

test("ContentGate public figwright assets are complete, sharp, and retain locked artwork", async () => {
  for (const [family, variants] of Object.entries(EXPECTED_VARIANTS)) {
    for (const [variant, [expectedWidth, expectedHeight]] of Object.entries(variants)) {
      const variantRoot = join(
        PUBLIC_BUNDLE_ROOT,
        family,
        "figwright-v1",
        "variants",
        variant
      );
      const reference = await loadImage(join(variantRoot, "reference.png"));
      const background = await loadImage(join(variantRoot, "background.png"));

      assert.equal(
        reference.width,
        expectedWidth,
        `${family}/${variant} reference width drifted`
      );
      assert.equal(
        reference.height,
        expectedHeight,
        `${family}/${variant} reference height drifted`
      );
      assert.equal(
        background.width,
        expectedWidth,
        `${family}/${variant} background width drifted`
      );
      assert.equal(
        background.height,
        expectedHeight,
        `${family}/${variant} background height drifted`
      );

      const retainedPixels = similarPixelsInVisualRegion(reference, background);
      assert.ok(
        retainedPixels > 1_000,
        `${family}/${variant} background lost locked visual artwork (${retainedPixels} retained pixels)`
      );

      const { referenceRustPixels, retainedRustPixels } =
        retainedTopRustAccentPixels(reference, background);
      if (referenceRustPixels > 0) {
        assert.ok(
          retainedRustPixels / referenceRustPixels > 0.95,
          `${family}/${variant} background lost the locked top rust accent (${retainedRustPixels}/${referenceRustPixels} retained pixels)`
        );
      }
    }
  }
});
