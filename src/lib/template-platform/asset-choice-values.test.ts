import assert from "node:assert/strict";
import test from "node:test";

import {
  LEGACY_PRODUCT_VARIANT_FIELD,
  resolveTemplateAssetChoiceValues,
} from "./asset-choice-values.ts";
import type { TemplateBundleField } from "./manifest.ts";

const heroAssetField: TemplateBundleField = {
  key: "hero_asset",
  label: "Hero asset",
  type: "asset_choice",
  source: "user",
  defaultValue: "manifest-default",
};

const logoField: TemplateBundleField = {
  key: "brand_logo",
  label: "Brand logo",
  type: "asset_choice",
  source: "user",
  options: ["option-default"],
};

const legacyProductField: TemplateBundleField = {
  key: LEGACY_PRODUCT_VARIANT_FIELD,
  label: "Product",
  type: "asset_choice",
  source: "user",
};

test("requested generic asset choices override saved and default values", () => {
  assert.deepEqual(
    resolveTemplateAssetChoiceValues({
      fields: [heroAssetField],
      requestedChoices: { hero_asset: "requested-asset" },
      replaceFields: { hero_asset: "replace-asset" },
      campaignSourceFields: { hero_asset: "source-asset" },
      defaultCopy: { hero_asset: "default-copy-asset" },
    }),
    { hero_asset: "requested-asset" }
  );
});

test("asset choices inherit from draft, campaign source, default copy, manifest default, then options", () => {
  assert.deepEqual(
    resolveTemplateAssetChoiceValues({
      fields: [heroAssetField, logoField],
      replaceFields: { hero_asset: "replace-asset" },
      campaignSourceFields: { brand_logo: "source-logo" },
      defaultCopy: { hero_asset: "default-copy-asset", brand_logo: "default-logo" },
    }),
    { hero_asset: "replace-asset", brand_logo: "source-logo" }
  );
  assert.deepEqual(
    resolveTemplateAssetChoiceValues({
      fields: [heroAssetField, logoField],
    }),
    { hero_asset: "manifest-default", brand_logo: "option-default" }
  );
});

test("legacy product variant choice remains backward compatible", () => {
  assert.deepEqual(
    resolveTemplateAssetChoiceValues({
      fields: [legacyProductField],
      legacyProductVariantChoice: "legacy-packshot",
      defaultCopy: { [LEGACY_PRODUCT_VARIANT_FIELD]: "default-packshot" },
    }),
    { [LEGACY_PRODUCT_VARIANT_FIELD]: "legacy-packshot" }
  );
});

test("empty requested values are ignored instead of clearing an inherited asset", () => {
  assert.deepEqual(
    resolveTemplateAssetChoiceValues({
      fields: [heroAssetField],
      requestedChoices: { hero_asset: "" },
      replaceFields: { hero_asset: "replace-asset" },
    }),
    { hero_asset: "replace-asset" }
  );
});
