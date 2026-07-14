import assert from "node:assert/strict";
import test from "node:test";

import { buildContentGateTemplateBundle } from "./contentgate-bundle";
import {
  getTemplateBundleSupportedSizes,
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
