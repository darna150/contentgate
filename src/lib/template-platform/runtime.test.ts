import assert from "node:assert/strict";
import test from "node:test";

import { buildContentGateTemplateBundle } from "./contentgate-bundle";
import { validTemplateBundleManifest } from "./test-fixtures";
import {
  getTemplateBundleVariantBackgroundOptions,
  getTemplateBundleSupportedSizes,
  getTemplateBundleVariantDimensions,
  getTemplateBundleVariantFieldLimits,
  getTemplateBundleVariantFields,
  resolveTemplateBundleRuntimeVariant,
} from "./runtime";

test("resolves ContentGate Set A size-specific fields and limits", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_friendly");

  assert.deepEqual(getTemplateBundleSupportedSizes(bundle.manifest), [
    "square",
    "story",
    "link_ad",
    "leaderboard",
    "medium_rectangle",
  ]);
  assert.deepEqual(
    getTemplateBundleVariantFields(bundle.manifest, "leaderboard").map((field) => field.key),
    ["headline", "subheadline", "cta"]
  );
  assert.deepEqual(getTemplateBundleVariantFieldLimits(bundle.manifest, "leaderboard"), {
    headline: { max_chars: 31, max_words: undefined, max_lines: 1 },
    subheadline: { max_chars: 78, max_words: undefined, max_lines: 1 },
    cta: { max_chars: 18, max_words: undefined, max_lines: 1 },
  });
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
