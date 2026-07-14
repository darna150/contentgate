import assert from "node:assert/strict";
import test from "node:test";

import { validTemplateBundleManifest } from "./test-fixtures.ts";
import {
  buildProductTemplateAssignmentUpsert,
  decideTemplateVersionPublish,
  resolveAssignmentDefaultVariant,
} from "./publishing.ts";

test("publishes only ready or already published template versions", () => {
  assert.deepEqual(decideTemplateVersionPublish("ready"), {
    ok: true,
    alreadyPublished: false,
  });
  assert.deepEqual(decideTemplateVersionPublish("published"), {
    ok: true,
    alreadyPublished: true,
  });
  assert.equal(decideTemplateVersionPublish("draft").ok, false);
  assert.equal(decideTemplateVersionPublish("validating").ok, false);
  assert.equal(decideTemplateVersionPublish("retired").ok, false);
});

test("resolves assignment default variants from the manifest", () => {
  const manifest = validTemplateBundleManifest;
  assert.deepEqual(resolveAssignmentDefaultVariant({ manifest }), {
    ok: true,
    variantKey: "square",
  });
  assert.deepEqual(resolveAssignmentDefaultVariant({ manifest }), {
    ok: true,
    variantKey: "square",
  });
  assert.equal(
    resolveAssignmentDefaultVariant({
      manifest,
      requestedDefaultVariantKey: "missing",
    }).ok,
    false
  );
});

test("builds an active product template assignment upsert payload", () => {
  const manifest = validTemplateBundleManifest;
  const result = buildProductTemplateAssignmentUpsert({
    orgId: "org-1",
    productId: "product-1",
    templateFamilyId: "family-1",
    templateVersionId: "version-1",
    manifest,
    defaultVariantKey: "square",
    generationProfile: { tone: "local" },
    defaultPayload: { cta: "Shop now" },
    allowedLocales: ["en", "es"],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.row, {
    org_id: "org-1",
    product_id: "product-1",
    template_family_id: "family-1",
    template_version_id: "version-1",
    status: "active",
    default_variant_key: "square",
    generation_profile: { tone: "local" },
    default_payload: { cta: "Shop now" },
    allowed_locales: ["en", "es"],
  });
});
