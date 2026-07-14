import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTemplatePlatformAssignment } from "./assignments.ts";
import { validTemplateBundleManifest } from "./test-fixtures.ts";

const activeRow = {
  id: "assignment-id",
  product_id: "product-id",
  status: "active",
  default_variant_key: null,
  generation_profile: {},
  default_payload: {},
  template_families: {
    id: "family-id",
    family_key: "contentgate-local-friendly",
    name: "ContentGate Local Friendly",
  },
  template_versions: {
    id: "version-id",
    version_label: "v1",
    status: "published",
    manifest: validTemplateBundleManifest,
  },
};

test("normalizes active platform assignment pinned to a published version", () => {
  const runtime = normalizeTemplatePlatformAssignment(activeRow);
  assert.ok(runtime);
  assert.equal(runtime.assignmentId, "assignment-id");
  assert.equal(runtime.versionId, "version-id");
  assert.deepEqual(runtime.supportedSizes, ["square"]);
  assert.equal(runtime.defaultVariantKey, "square");
});

test("rejects inactive assignments and unpublished versions", () => {
  assert.equal(
    normalizeTemplatePlatformAssignment({ ...activeRow, status: "paused" }),
    null
  );
  assert.equal(
    normalizeTemplatePlatformAssignment({
      ...activeRow,
      template_versions: { ...activeRow.template_versions, status: "ready" },
    }),
    null
  );
});

test("rejects default variants not present in the manifest", () => {
  assert.equal(
    normalizeTemplatePlatformAssignment({
      ...activeRow,
      default_variant_key: "story",
    }),
    null
  );
});
