import assert from "node:assert/strict";
import test from "node:test";

import {
  compileTemplateBundleImport,
  stableJsonSha256,
} from "./compiler.ts";
import { validTemplateBundleManifest } from "./test-fixtures.ts";

const fixedIds = {
  familyId: "11111111-1111-4111-8111-111111111111",
  versionId: "22222222-2222-4222-8222-222222222222",
  importRunId: "33333333-3333-4333-8333-333333333333",
  variantIds: {
    square: "44444444-4444-4444-8444-444444444444",
  },
  assetIds: {
    "inter-bold-file": "55555555-5555-4555-8555-555555555555",
    "square-reference": "66666666-6666-4666-8666-666666666666",
    "square-background": "77777777-7777-4777-8777-777777777777",
  },
};

const compileOptions = {
  orgId: "99999999-9999-4999-8999-999999999999",
  createdBy: "88888888-8888-4888-8888-888888888888",
  storagePrefix: "template-bundles/contentgate-local-friendly/v1",
  now: new Date("2026-07-14T10:00:00.000Z"),
  ids: fixedIds,
};

test("compiles a valid bundle into template platform insert rows", () => {
  const result = compileTemplateBundleImport(
    validTemplateBundleManifest,
    compileOptions
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.value.rows.family.id, fixedIds.familyId);
  assert.equal(result.value.rows.family.family_key, "contentgate-local-friendly");
  assert.equal(result.value.rows.version.family_id, fixedIds.familyId);
  assert.equal(result.value.rows.version.id, fixedIds.versionId);
  assert.equal(result.value.rows.version.status, "ready");
  assert.equal(result.value.rows.version.source_file_key, "figma-file-key");
  assert.equal(result.value.rows.importRun.template_version_id, fixedIds.versionId);
  assert.equal(result.value.rows.importRun.status, "ready");

  assert.deepEqual(result.value.rows.variants, [
    {
      id: fixedIds.variantIds.square,
      org_id: compileOptions.orgId,
      template_version_id: fixedIds.versionId,
      variant_key: "square",
      label: "Square",
      channel: "social",
      width: 1080,
      height: 1080,
      field_keys: ["headline", "hero_image"],
      slot_manifest: validTemplateBundleManifest.variants[0].slots,
    },
  ]);
});

test("assigns reference and background assets to their variant and fonts to the version", () => {
  const result = compileTemplateBundleImport(
    validTemplateBundleManifest,
    compileOptions
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const assetsByKey = Object.fromEntries(
    result.value.rows.assets.map((asset) => [asset.asset_key, asset])
  );
  assert.equal(assetsByKey["inter-bold-file"].variant_id, null);
  assert.equal(assetsByKey["square-reference"].variant_id, fixedIds.variantIds.square);
  assert.equal(assetsByKey["square-background"].variant_id, fixedIds.variantIds.square);
  assert.equal(
    assetsByKey["square-background"].storage_path,
    "template-bundles/contentgate-local-friendly/v1/variants/square/background.png"
  );
});

test("uses canonical JSON hashing so object key order does not alter the manifest hash", () => {
  assert.equal(
    stableJsonSha256({ b: 2, a: { d: 4, c: 3 } }),
    stableJsonSha256({ a: { c: 3, d: 4 }, b: 2 })
  );
});

test("blocks bundle paths that could escape the bundle root", () => {
  const invalid = {
    ...validTemplateBundleManifest,
    assets: [
      {
        ...validTemplateBundleManifest.assets[0],
        path: "../fonts/Inter-Bold.ttf",
      },
      ...validTemplateBundleManifest.assets.slice(1),
    ],
  };
  const result = compileTemplateBundleImport(invalid, compileOptions);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(
    result.issues.some(
      (issue) =>
        issue.code === "asset_shape" &&
        issue.message.includes("relative") &&
        issue.path === "assets.0.path"
    ),
    true
  );
});
