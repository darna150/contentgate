import assert from "node:assert/strict";
import test from "node:test";

import { templateBundleStoragePath } from "./storage-path.ts";
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
