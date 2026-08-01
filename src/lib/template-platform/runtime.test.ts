import assert from "node:assert/strict";
import test from "node:test";

import { buildContentGateTemplateBundle } from "./contentgate-bundle";
import { validTemplateBundleManifest } from "./test-fixtures";
import {
  getTemplateBundleVariantBackgroundOptions,
  getTemplateBundleVariantEditableFields,
  getTemplateBundleVariantGeneratedFields,
  getTemplateBundleVariantReferenceFields,
  getTemplateBundleSupportedSizes,
  getTemplateBundleVariantDimensions,
  resolveTemplateBundleRuntimeVariant,
} from "./runtime";

test("resolves authored reference copy for generation comparison", () => {
  const manifest = {
    ...validTemplateBundleManifest,
    family: {
      ...validTemplateBundleManifest.family,
      key: "nimbus-air-campaign",
    },
    variants: validTemplateBundleManifest.variants.map((variant) => ({
      ...variant,
      referenceFields: {
        headline: "A declared authored headline",
        missing_field: "This undeclared field must be ignored",
      },
    })),
  };

  assert.deepEqual(getTemplateBundleVariantReferenceFields(manifest, "square"), {
    headline: "A declared authored headline",
  });
});

test("keeps system asset controls out of editable and AI-generated copy", () => {
  const manifest = {
    ...validTemplateBundleManifest,
    fields: [
      ...validTemplateBundleManifest.fields,
      {
        key: "__productVariantKey",
        label: "Product variant",
        type: "asset_choice" as const,
        source: "user" as const,
        required: false,
      },
    ],
    variants: validTemplateBundleManifest.variants.map((variant) => ({
      ...variant,
      slots: [
        ...variant.slots,
        {
          key: "product",
          field: "__productVariantKey",
          kind: "image" as const,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fit: "contain" as const,
        },
      ],
    })),
  };

  assert.equal(
    getTemplateBundleVariantEditableFields(manifest, "square").some(
      (field) => field.key === "__productVariantKey"
    ),
    false
  );
  assert.equal(
    getTemplateBundleVariantGeneratedFields(manifest, "square").some(
      (field) => field.key === "__productVariantKey"
    ),
    false
  );
});

test("resolves ContentGate Set B without exposing unsupported leaderboard", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_premium");

  assert.deepEqual(getTemplateBundleSupportedSizes(bundle.manifest), [
    "square",
    "portrait",
    "story",
    "link_ad",
    "medium_rectangle",
  ]);
  assert.equal(resolveTemplateBundleRuntimeVariant(bundle.manifest, "leaderboard"), null);

  const story = resolveTemplateBundleRuntimeVariant(bundle.manifest, "story");
  assert.ok(story);
  assert.equal(
    story.backgroundAssetPath,
    "template-packages/contentgate/set-b/backgrounds/story.png"
  );
  assert.equal(story.fieldLimits.headline.max_chars, 64);
  assert.equal(story.fieldLimits.headline.max_lines, 3);
});

test("exposes arbitrary manifest variant keys instead of filtering through the legacy size enum", () => {
  const manifest = {
    ...validTemplateBundleManifest,
    assets: [
      ...validTemplateBundleManifest.assets,
      {
        key: "billboard-reference",
        kind: "reference" as const,
        path: "variants/billboard_970x250/reference.png",
        sha256: "d".repeat(64),
        width: 970,
        height: 250,
        mimeType: "image/png",
      },
      {
        key: "billboard-background",
        kind: "background" as const,
        path: "variants/billboard_970x250/background.png",
        sha256: "e".repeat(64),
        width: 970,
        height: 250,
        mimeType: "image/png",
      },
    ],
    variants: [
      ...validTemplateBundleManifest.variants,
      {
        ...validTemplateBundleManifest.variants[0],
        key: "billboard_970x250",
        label: "Billboard 970×250",
        channel: "display_ad" as const,
        width: 970,
        height: 250,
        referenceAsset: "billboard-reference",
        backgroundAsset: "billboard-background",
      },
    ],
  };

  assert.deepEqual(getTemplateBundleSupportedSizes(manifest), [
    "square",
    "billboard_970x250",
  ]);
  assert.deepEqual(getTemplateBundleVariantDimensions(manifest, "billboard_970x250"), {
    w: 970,
    h: 250,
  });
  assert.equal(
    resolveTemplateBundleRuntimeVariant(manifest, "billboard_970x250")
      ?.backgroundAssetPath,
    "variants/billboard_970x250/background.png"
  );
});

test("resolves designer-approved background options and selected background path", () => {
  const options = getTemplateBundleVariantBackgroundOptions(
    validTemplateBundleManifest,
    "square"
  );

  assert.deepEqual(
    options.map((option) => ({
      key: option.key,
      label: option.label,
      assetPath: option.assetPath,
    })),
    [
      {
        key: "default",
        label: "Default",
        assetPath: "variants/square/background.png",
      },
      {
        key: "warm",
        label: "Warm layout",
        assetPath: "variants/square/background-alt.png",
      },
    ]
  );

  assert.equal(
    resolveTemplateBundleRuntimeVariant(validTemplateBundleManifest, "square", "warm")
      ?.backgroundAssetPath,
    "variants/square/background-alt.png"
  );
  assert.equal(
    resolveTemplateBundleRuntimeVariant(validTemplateBundleManifest, "square", "unknown")
      ?.backgroundAssetPath,
    "variants/square/background.png"
  );
});
