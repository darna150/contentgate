import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProductAssetStoragePath,
  defaultProductAssetTitle,
  isProductAssetStoragePath,
  parseProductAssetTags,
  productAssetMediaKindForMimeType,
  sanitizeProductAssetFileName,
  validateProductAssetFile,
} from "./product-assets.ts";

test("builds an organization and product scoped storage path", () => {
  const path = buildProductAssetStoragePath(
    "org-1",
    "product-1",
    "Primary Logo (Final).PNG",
    "asset-1"
  );

  assert.equal(path, "org-1/product-1/asset-1-primary-logo-final.png");
  assert.equal(isProductAssetStoragePath(path, "org-1", "product-1"), true);
  assert.equal(isProductAssetStoragePath(path, "org-2", "product-1"), false);
  assert.equal(isProductAssetStoragePath(path, "org-1", "product-2"), false);
});

test("builds an organization and brand scoped storage path", () => {
  const path = buildProductAssetStoragePath(
    "org-1",
    null,
    "Brand Guide.png",
    "asset-2"
  );

  assert.equal(path, "org-1/brand/asset-2-brand-guide.png");
  assert.equal(isProductAssetStoragePath(path, "org-1", null), true);
  assert.equal(isProductAssetStoragePath(path, "org-1", "product-1"), false);
});

test("sanitizes file names and creates a useful default title", () => {
  assert.equal(sanitizeProductAssetFileName("  Päck Shot 01.JPG "), "pack-shot-01.jpg");
  assert.equal(defaultProductAssetTitle("pack-shot_01.jpg"), "pack shot 01");
});

test("normalizes, deduplicates, and limits tags", () => {
  assert.deepEqual(
    parseProductAssetTags("Launch, Social, launch,  Hero Image  "),
    ["launch", "social", "hero image"]
  );
});

test("detects supported asset media kinds", () => {
  assert.equal(productAssetMediaKindForMimeType("image/png"), "image");
  assert.equal(productAssetMediaKindForMimeType("video/mp4"), "video");
  assert.equal(productAssetMediaKindForMimeType("application/pdf"), null);
});

test("accepts supported video assets and rejects oversized videos", () => {
  const video = new File([new Uint8Array(1024)], "launch.mp4", { type: "video/mp4" });
  assert.doesNotThrow(() => validateProductAssetFile(video));

  const tooLargeVideo = new File([new Blob([], { type: "video/mp4" })], "large.mp4", {
    type: "video/mp4",
  });
  Object.defineProperty(tooLargeVideo, "size", { value: 100 * 1024 * 1024 + 1 });
  assert.throws(() => validateProductAssetFile(tooLargeVideo), /100 MB/);
});
