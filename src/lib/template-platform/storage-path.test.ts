import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveTemplateBundleAssetStoragePath,
  templateBundleStoragePath,
} from "./storage-path.ts";
import { validTemplateBundleManifest } from "./test-fixtures.ts";

test("scopes template bundle assets to their organization", () => {
  assert.equal(
    templateBundleStoragePath(
      "00000000-0000-0000-0000-000000000001",
      validTemplateBundleManifest,
      "variants/square/background.png"
    ),
    "00000000-0000-0000-0000-000000000001/template-bundles/example-campaign/v1/variants/square/background.png"
  );
});

test("prefers the published asset record over a reconstructed manifest path", () => {
  const asset = validTemplateBundleManifest.assets[0];
  const storedPath =
    `00000000-0000-0000-0000-000000000001/template-bundles/example-campaign/v1/` +
    `assets/${asset.sha256}/background.png`;

  assert.equal(
    resolveTemplateBundleAssetStoragePath({
      orgId: "00000000-0000-0000-0000-000000000001",
      versionId: "version-1",
      manifest: validTemplateBundleManifest,
      asset,
      storedAssets: [
        {
          template_version_id: "version-1",
          asset_key: asset.key,
          sha256: asset.sha256,
          storage_path: storedPath,
        },
      ],
    }),
    storedPath
  );
});

test("does not trust a stored asset path outside the organization", () => {
  const asset = validTemplateBundleManifest.assets[0];

  assert.equal(
    resolveTemplateBundleAssetStoragePath({
      orgId: "00000000-0000-0000-0000-000000000001",
      versionId: "version-1",
      manifest: validTemplateBundleManifest,
      asset,
      storedAssets: [
        {
          template_version_id: "version-1",
          asset_key: asset.key,
          sha256: asset.sha256,
          storage_path: `another-org/assets/${asset.sha256}/background.png`,
        },
      ],
    }),
    `00000000-0000-0000-0000-000000000001/template-bundles/example-campaign/v1/${asset.path}`
  );
});
