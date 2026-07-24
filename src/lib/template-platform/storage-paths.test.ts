import assert from "node:assert/strict";
import test from "node:test";

import { templateBundleAssetStoragePath } from "./storage-paths.ts";

test("builds content-addressed bundle asset storage paths", () => {
  assert.equal(
    templateBundleAssetStoragePath(" org-1 / template-bundles / nimbus / v1 ", {
      path: "variants/instagram post/background image.png",
      sha256: "a".repeat(64),
    }),
    `org-1/template-bundles/nimbus/v1/assets/${"a".repeat(64)}/background-image.png`
  );
});
