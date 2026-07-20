import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProductAssetStoragePath,
  defaultProductAssetTitle,
  isProductAssetStoragePath,
  parseProductAssetTags,
  sanitizeProductAssetFileName,
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
