import assert from "node:assert/strict";
import test from "node:test";

import { compileTemplateBundleImport } from "./compiler.ts";
import { validateTemplateBundlePublishReadiness } from "./publish-readiness.ts";
import { validTemplateBundleManifest } from "./test-fixtures.ts";
import type { TemplateBundleManifest } from "./manifest.ts";

const compileOptions = {
  orgId: "99999999-9999-4999-8999-999999999999",
  createdBy: "88888888-8888-4888-8888-888888888888",
  storagePrefix: "template-bundles/contentgate-local-friendly/v1",
  now: new Date("2026-07-14T10:00:00.000Z"),
};

test("accepts a publish-ready bundle manifest", () => {
  assert.deepEqual(validateTemplateBundlePublishReadiness(validTemplateBundleManifest), []);
});

test("blocks templates that reuse the full reference as the generated background", () => {
  const invalid: TemplateBundleManifest = {
    ...validTemplateBundleManifest,
    variants: [
      {
        ...validTemplateBundleManifest.variants[0],
        backgroundAsset: validTemplateBundleManifest.variants[0].referenceAsset,
      },
    ],
  };

  const issues = validateTemplateBundlePublishReadiness(invalid);
  assert.equal(
    issues.some(
      (issue) =>
        issue.code === "publish_gate" &&
        issue.message.includes("separate clean background")
    ),
    true
  );
});

test("blocks text slots that cannot fit their own declared line count", () => {
  const textSlot = validTemplateBundleManifest.variants[0].slots[0];
  assert.equal(textSlot.kind, "text");

  const invalid: TemplateBundleManifest = {
    ...validTemplateBundleManifest,
    variants: [
      {
        ...validTemplateBundleManifest.variants[0],
        slots: [
          {
            ...textSlot,
            height: 24,
            maxLines: 2,
          },
        ],
      },
    ],
  };

  const result = compileTemplateBundleImport(invalid, compileOptions);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(
    result.issues.some(
      (issue) =>
        issue.code === "geometry" &&
        issue.message.includes("cannot fit")
    ),
    true
  );
});

test("blocks image slots wired to text fields before a bundle can become ready", () => {
  const imageSlot = validTemplateBundleManifest.variants[0].slots[1];
  assert.equal(imageSlot.kind, "image");

  const invalid: TemplateBundleManifest = {
    ...validTemplateBundleManifest,
    variants: [
      {
        ...validTemplateBundleManifest.variants[0],
        slots: [
          {
            ...imageSlot,
            field: "headline",
          },
        ],
      },
    ],
  };

  const issues = validateTemplateBundlePublishReadiness(invalid);
  assert.equal(
    issues.some(
      (issue) =>
        issue.code === "field_reference" &&
        issue.message.includes("image-compatible")
    ),
    true
  );
});
