import assert from "node:assert/strict";
import test from "node:test";

import { compileTemplateBundleImport } from "./compiler.ts";
import { buildContentGateTemplateBundle } from "./contentgate-bundle.ts";
import { validateTemplateBundleManifest } from "./manifest.ts";

test("builds a valid ContentGate Set A template bundle from Figma exports", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_friendly");

  assert.equal(bundle.manifest.family.key, "aerform-air01-campaign");
  assert.deepEqual(
    bundle.manifest.variants.map((variant) => variant.key),
    [
      "portrait",
      "square",
      "story",
      "linkedin_square",
      "link_ad",
      "medium_rectangle",
      "leaderboard",
      "us_letter",
      "poster",
      "rack_card",
    ]
  );
  assert.equal(
    bundle.manifest.fonts.every((font) => font.family === "Inter"),
    true
  );
  assert.equal(
    bundle.manifest.assets.some(
      (asset) =>
        asset.kind === "background" &&
        asset.path === "variants/leaderboard/background.png"
    ),
    true
  );
  assert.deepEqual(bundle.manifest.variants[0].backgroundOptions, [
    {
      key: "classic-cream",
      label: "Warm editorial studio",
      asset: "variants-portrait-background-classic-cream-png-background",
    },
    {
      key: "mint-glow",
      label: "Transit concourse",
      asset: "variants-portrait-background-mint-glow-png-background",
    },
    {
      key: "terracotta-edge",
      label: "Dark threshold",
      asset: "variants-portrait-background-terracotta-edge-png-background",
    },
    {
      key: "sage-grid",
      label: "Coastal overlook",
      asset: "variants-portrait-background-sage-grid-png-background",
    },
  ]);
  assert.deepEqual(validateTemplateBundleManifest(bundle.manifest), []);

  const compiled = compileTemplateBundleImport(bundle.manifest, {
    orgId: "99999999-9999-4999-8999-999999999999",
    storagePrefix: "template-bundles/contentgate-local-friendly/v1",
  });
  assert.equal(compiled.ok, true);
});

test("builds a valid ContentGate Set B template bundle with portrait support", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_premium");

  assert.equal(bundle.manifest.family.key, "aerform-air01-campaign");
  assert.deepEqual(
    bundle.manifest.variants.map((variant) => variant.key),
    [
      "portrait",
      "square",
      "story",
      "linkedin_square",
      "link_ad",
      "medium_rectangle",
      "leaderboard",
      "us_letter",
      "poster",
      "rack_card",
    ]
  );
  assert.equal(
    bundle.manifest.assets.some(
      (asset) =>
        asset.kind === "reference" &&
        asset.path === "variants/portrait/reference.png"
    ),
    true
  );
  assert.deepEqual(validateTemplateBundleManifest(bundle.manifest), []);
});

test("bundle asset payloads match manifest asset paths and checksums", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_friendly");
  const payloadPaths = new Set(bundle.assets.map((asset) => asset.path));

  for (const asset of bundle.manifest.assets) {
    assert.equal(payloadPaths.has(asset.path), true, `${asset.path} is missing a payload`);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
  }
});
