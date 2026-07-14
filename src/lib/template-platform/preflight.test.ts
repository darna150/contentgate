import assert from "node:assert/strict";
import test from "node:test";

import {
  formatTemplateBundlePreflightReport,
  preflightTemplateBundle,
} from "./preflight.ts";
import { validTemplateBundleManifest } from "./test-fixtures.ts";

test("preflights a publish-ready bundle with fitting sample copy", async () => {
  const report = await preflightTemplateBundle({
    manifest: validTemplateBundleManifest,
    samples: [
      {
        key: "happy-path",
        fields: {
          cta: "Learn",
          headline: "On brand",
          hero_image: "",
        },
      },
    ],
    now: new Date("2026-07-14T10:00:00.000Z"),
  });

  assert.equal(report.ok, true);
  assert.equal(report.variantCount, 1);
  assert.equal(report.sampleCount, 1);
  assert.deepEqual(report.issues, []);
  assert.match(formatTemplateBundlePreflightReport(report), /^PASS /);
});

test("preflight blocks missing required sample fields", async () => {
  const report = await preflightTemplateBundle({
    manifest: validTemplateBundleManifest,
    samples: [{ key: "missing-headline", fields: { hero_image: "" } }],
  });

  assert.equal(report.ok, false);
  assert.equal(
    report.issues.some(
      (issue) =>
        issue.code === "publish_gate" &&
        issue.message.includes('Required field "headline"')
    ),
    true
  );
});

test("preflight blocks sample copy that does not fit a variant", async () => {
  const report = await preflightTemplateBundle({
    manifest: validTemplateBundleManifest,
    samples: [
      {
        key: "too-long",
        fields: {
          headline:
            "This headline is intentionally much too long to fit inside the declared two-line square template headline slot",
          hero_image: "",
        },
      },
    ],
  });

  assert.equal(report.ok, false);
  assert.equal(
    report.issues.some(
      (issue) =>
        issue.code === "geometry" &&
        issue.message.includes('Sample "too-long" does not fit variant "square"')
    ),
    true
  );
});
