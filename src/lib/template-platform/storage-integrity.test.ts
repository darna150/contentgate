import assert from "node:assert/strict";
import test from "node:test";

import { decideTemplateVersionStorageIntegrity } from "./storage-integrity.ts";

test("accepts a non-empty template version only when every asset is present", () => {
  assert.deepEqual(
    decideTemplateVersionStorageIntegrity({
      asset_count: 3,
      present_asset_count: 3,
      missing_asset_keys: [],
    }),
    { ok: true, assetCount: 3 }
  );
});

test("fails closed for missing, malformed, or empty storage integrity reports", () => {
  assert.deepEqual(
    decideTemplateVersionStorageIntegrity({
      asset_count: 3,
      present_asset_count: 2,
      missing_asset_keys: ["square-background"],
    }),
    {
      ok: false,
      assetCount: 3,
      presentAssetCount: 2,
      missingAssetKeys: ["square-background"],
    }
  );
  assert.equal(decideTemplateVersionStorageIntegrity(null).ok, false);
  assert.equal(
    decideTemplateVersionStorageIntegrity({
      asset_count: 0,
      present_asset_count: 0,
      missing_asset_keys: [],
    }).ok,
    false
  );
});
