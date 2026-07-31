import assert from "node:assert/strict";
import test from "node:test";

import {
  getTemplateProductAssetPath,
  getTemplateProductAssetPaths,
  getTemplateVariantRenderAssetPaths,
} from "./live-preview-assets";
import { validTemplateBundleManifest } from "./test-fixtures";

test("selects only the current variant's render assets, not reference exports", () => {
  const paths = getTemplateVariantRenderAssetPaths(validTemplateBundleManifest, "square");

  assert.deepEqual(paths, [
    "variants/square/background.png",
    "variants/square/background-alt.png",
    "fonts/Inter-Bold.ttf",
  ]);
  assert.ok(!paths.includes("variants/square/reference.png"));
});

test("resolves product choices without treating unrelated images as product variants", () => {
  const manifest = {
    ...validTemplateBundleManifest,
    assets: [
      ...validTemplateBundleManifest.assets,
      {
        key: "product-nimbus-1",
        kind: "image" as const,
        path: "products/nimbus-1.png",
        sha256: "1".repeat(64),
      },
      {
        key: "decorative-mark",
        kind: "image" as const,
        path: "images/mark.png",
        sha256: "2".repeat(64),
      },
    ],
  };

  assert.equal(getTemplateProductAssetPath(manifest, "nimbus-1"), "products/nimbus-1.png");
  assert.deepEqual(getTemplateProductAssetPaths(manifest), ["products/nimbus-1.png"]);
});
