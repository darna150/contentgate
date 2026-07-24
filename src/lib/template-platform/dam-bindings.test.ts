import assert from "node:assert/strict";
import test from "node:test";

import {
  assetMatchesTemplateBinding,
  buildTemplateAssetChoiceOptions,
} from "./dam-bindings.ts";
import type { TemplateBundleField } from "./manifest.ts";

const field: TemplateBundleField = {
  key: "hero_asset",
  label: "Hero asset",
  type: "asset_choice",
  source: "user",
  assetBinding: {
    source: "product_assets",
    scope: "product_or_brand",
    mediaKind: "image",
    assetType: "packshot",
    category: "hero",
    tags: ["front"],
  },
};

const matchingAsset = {
  id: "asset-1",
  product_id: "product-1",
  asset_type: "packshot",
  title: "Front packshot",
  storage_path: "org/product/asset.png",
  mime_type: "image/png",
  media_kind: "image",
  category: "hero",
  tags: ["front", "retail"],
};

test("matches approved DAM assets against manifest binding metadata", () => {
  assert.equal(
    assetMatchesTemplateBinding({
      asset: matchingAsset,
      field,
      productId: "product-1",
    }),
    true
  );
  assert.equal(
    assetMatchesTemplateBinding({
      asset: { ...matchingAsset, product_id: "other-product" },
      field,
      productId: "product-1",
    }),
    false
  );
  assert.equal(
    assetMatchesTemplateBinding({
      asset: { ...matchingAsset, tags: ["retail"] },
      field,
      productId: "product-1",
    }),
    false
  );
});

test("builds Studio picker options from DAM assets and preserves manifest fallback options", () => {
  const previewUrls = new Map([[matchingAsset.storage_path, "signed-url"]]);
  assert.deepEqual(
    buildTemplateAssetChoiceOptions({
      field,
      productId: "product-1",
      assets: [matchingAsset],
      previewUrlByStoragePath: previewUrls,
    }),
    [
      {
        key: "asset-1",
        label: "Front packshot",
        previewUrl: "signed-url",
        storagePath: "org/product/asset.png",
      },
    ]
  );
  assert.deepEqual(
    buildTemplateAssetChoiceOptions({
      field: {
        key: "bundled",
        label: "Bundled",
        type: "asset_choice",
        source: "user",
        options: ["charcoal"],
      },
      productId: "product-1",
      assets: [],
    }),
    [{ key: "charcoal", label: "charcoal" }]
  );
});
