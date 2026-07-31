import assert from "node:assert/strict";
import test from "node:test";

import {
  templateBundleFieldsForVariant,
  validateTemplateBundleManifest,
  type TemplateBundleManifest,
} from "./manifest.ts";
import { validTemplateBundleManifest } from "./test-fixtures.ts";

const validManifest = validTemplateBundleManifest;

test("accepts a portable Figma-derived template bundle manifest", () => {
  assert.deepEqual(validateTemplateBundleManifest(validManifest), []);
});

test("derives the size-specific editable field list from slots", () => {
  assert.deepEqual(
    templateBundleFieldsForVariant(validManifest, "square").map((field) => field.key),
    ["headline", "hero_image"]
  );
});

test("blocks missing assets, fonts, fields, and impossible slot geometry", () => {
  const headlineSlot = validManifest.variants[0].slots[0];
  assert.equal(headlineSlot.kind, "text");
  const invalid: TemplateBundleManifest = {
    ...validManifest,
    assets: validManifest.assets.filter((asset) => asset.key !== "square-background"),
    variants: [
      {
        ...validManifest.variants[0],
        backgroundAsset: "missing-background",
        slots: [
          {
            ...headlineSlot,
            field: "missing-field",
            fontKey: "missing-font",
            x: 1000,
            width: 200,
          },
        ],
      },
    ],
  };
  const codes = validateTemplateBundleManifest(invalid).map((item) => item.code);
  assert.equal(codes.includes("asset_reference"), true);
  assert.equal(codes.includes("field_reference"), true);
  assert.equal(codes.includes("font_reference"), true);
  assert.equal(codes.includes("geometry"), true);
});

test("requires unique semantic keys so Figma layer names are not the contract", () => {
  const invalid = {
    ...validManifest,
    fields: [...validManifest.fields, validManifest.fields[0]],
  };
  assert.equal(
    validateTemplateBundleManifest(invalid).some(
      (issue) => issue.code === "duplicate_key" && issue.path === "fields.3.key"
    ),
    true
  );
});

test("validates background option keys and asset references", () => {
  const invalid: TemplateBundleManifest = {
    ...validManifest,
    variants: [
      {
        ...validManifest.variants[0],
        backgroundOptions: [
          {
            key: "default",
            label: "Default",
            asset: "square-background",
          },
          {
            key: "default",
            label: "Duplicate",
            asset: "missing-background",
          },
        ],
      },
    ],
  };

  const issues = validateTemplateBundleManifest(invalid);
  assert.equal(
    issues.some((issue) => issue.code === "duplicate_key" && issue.path.endsWith(".key")),
    true
  );
  assert.equal(
    issues.some((issue) => issue.code === "asset_reference" && issue.path.endsWith(".asset")),
    true
  );
});

test("validates DAM asset binding metadata on manifest fields", () => {
  const invalid: TemplateBundleManifest = {
    ...validManifest,
    fields: validManifest.fields.map((field) =>
      field.key === "hero_image"
        ? {
            ...field,
            assetBinding: {
              source: "product_assets",
              scope: "not-a-scope",
              mediaKind: "audio",
              tags: ["packshot", ""],
            } as never,
          }
        : field
    ),
  };

  const issues = validateTemplateBundleManifest(invalid);
  assert.equal(issues.some((issue) => issue.path.endsWith(".scope")), true);
  assert.equal(issues.some((issue) => issue.path.endsWith(".mediaKind")), true);
  assert.equal(issues.some((issue) => issue.path.endsWith(".tags")), true);
});
