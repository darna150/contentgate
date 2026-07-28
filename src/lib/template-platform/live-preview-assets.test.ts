import assert from "node:assert/strict";
import test from "node:test";

import { getTemplateVariantRenderAssetPaths } from "./live-preview-assets";
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
