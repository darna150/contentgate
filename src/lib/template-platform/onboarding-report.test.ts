import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTemplateOnboardingReport,
  formatTemplateOnboardingReport,
} from "./onboarding-report.ts";
import type { TemplateBundleManifest } from "./manifest.ts";

const manifest: TemplateBundleManifest = {
  schemaVersion: "template-bundle-v1",
  family: {
    key: "client-campaign",
    name: "Client Campaign",
  },
  version: {
    name: "1.0.0",
    source: "manual",
  },
  assets: [
    {
      key: "reference",
      path: "variants/square/reference.png",
      kind: "reference",
      mimeType: "image/png",
      sha256: "hash",
      width: 1080,
      height: 1080,
    },
  ],
  fonts: [],
  fields: [
    {
      key: "headline",
      label: "Headline",
      type: "text",
      source: "ai",
    },
    {
      key: "hero_asset",
      label: "Hero asset",
      type: "asset_choice",
      source: "user",
      assetBinding: {
        source: "product_assets",
        scope: "product_or_brand",
        mediaKind: "image",
        assetType: "packshot",
        tags: ["front"],
      },
    },
  ],
  variants: [
    {
      key: "square",
      label: "Square",
      channel: "social",
      width: 1080,
      height: 1080,
      referenceAsset: "reference",
      backgroundAsset: "reference",
      slots: [],
    },
  ],
};

test("builds a client onboarding report with DAM binding summary", () => {
  const report = buildTemplateOnboardingReport({
    manifest,
    preflight: {
      ok: true,
      manifestKey: "client-campaign",
      versionName: "1.0.0",
      checkedAt: "2026-07-24T00:00:00.000Z",
      issues: [],
      variantCount: 1,
      sampleCount: 1,
    },
  });
  assert.equal(report.ok, true);
  assert.equal(report.familyKey, "client-campaign");
  assert.equal(report.damBoundFieldCount, 1);
  assert.match(report.fields[1].damBinding ?? "", /scope=product_or_brand/);
  assert.match(report.fields[1].damBinding ?? "", /tags=front/);
  assert.equal(report.blockers.length, 0);
});

test("formats blockers and next steps for an operator-readable report", () => {
  const report = buildTemplateOnboardingReport({
    manifest,
    preflight: {
      ok: false,
      manifestKey: "client-campaign",
      versionName: "1.0.0",
      checkedAt: "2026-07-24T00:00:00.000Z",
      issues: [
        {
          severity: "error",
          code: "asset_reference",
          path: "assets.0",
          message: "Asset payload is missing.",
        },
      ],
      variantCount: 1,
      sampleCount: 1,
    },
  });
  const text = formatTemplateOnboardingReport(report);
  assert.match(text, /Status: BLOCKED/);
  assert.match(text, /assets\.0: Asset payload is missing\./);
  assert.match(text, /Upload and approve matching brand\/product assets/);
});
