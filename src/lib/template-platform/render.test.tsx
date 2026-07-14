import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { buildContentGateTemplateBundle } from "./contentgate-bundle";
import {
  formatTemplatePlatformFitIssues,
  templatePlatformFieldFitIssues,
  templatePlatformFitInstructions,
} from "./fit";
import { validateTemplateBundlePublishReadiness } from "./publish-readiness";
import { renderTemplateBundleVariant } from "./render";

test("renders platform bundle generated mode with background and text slots", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_friendly");
  const rendered = renderTemplateBundleVariant({
    manifest: bundle.manifest,
    variantKey: "leaderboard",
    fields: {
      headline: "On-brand local content",
      subheadline: "Approved templates for every team",
      cta: "Learn more",
    },
  });

  assert.ok(rendered);
  assert.equal(rendered.width, 728);
  assert.equal(rendered.height, 90);
  const html = renderToStaticMarkup(rendered.element);
  assert.match(html, /set-a\/backgrounds\/leaderboard\.png/);
  assert.match(html, /On-brand local content/);
  assert.match(html, /data-template-platform-bundle="contentgate-local-friendly"/);
  assert.match(html, /overflow:hidden/);
});

test("renders platform bundle with signed asset URLs when provided", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_friendly");
  const rendered = renderTemplateBundleVariant({
    manifest: bundle.manifest,
    variantKey: "leaderboard",
    fields: {},
    assetUrlByPath: {
      "template-packages/contentgate/set-a/backgrounds/leaderboard.png":
        "https://storage.example.test/signed-background.png",
    },
  });

  assert.ok(rendered);
  const html = renderToStaticMarkup(rendered.element);
  assert.match(html, /https:\/\/storage\.example\.test\/signed-background\.png/);
});

test("renders platform bundle original mode with reference only", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_friendly");
  const rendered = renderTemplateBundleVariant({
    manifest: bundle.manifest,
    variantKey: "leaderboard",
    fields: {
      headline: "Hidden in original mode",
    },
    original: true,
  });

  assert.ok(rendered);
  const html = renderToStaticMarkup(rendered.element);
  assert.match(html, /set-a\/leaderboard\.png/);
  assert.doesNotMatch(html, /Hidden in original mode/);
});

test("reports platform copy that wraps beyond the locked text slot", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_friendly");
  const issues = await templatePlatformFieldFitIssues({
    manifest: bundle.manifest,
    variantKey: "leaderboard",
    fields: {
      headline:
        "This headline is intentionally much too long for a leaderboard banner text box",
      subheadline:
        "This subheadline is also intentionally long enough that it should wrap beyond the available single rendered line",
      cta: "Learn how it works",
    },
  });

  const messages = formatTemplatePlatformFitIssues(issues);
  assert.equal(messages.some((message) => message.includes("headline")), true);
  assert.equal(messages.some((message) => message.includes("subheadline")), true);
});

test("emits platform typography instructions from manifest slots", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_friendly");
  const instructions = templatePlatformFitInstructions({
    manifest: bundle.manifest,
    variantKey: "leaderboard",
  });

  assert.equal(instructions.some((line) => line.includes("headline")), true);
  assert.equal(instructions.some((line) => line.includes("px-wide")), true);
});

test("generated ContentGate platform bundles pass the publish-readiness gate", async () => {
  const [friendly, premium] = await Promise.all([
    buildContentGateTemplateBundle("contentgate_local_friendly"),
    buildContentGateTemplateBundle("contentgate_local_premium"),
  ]);

  assert.deepEqual(validateTemplateBundlePublishReadiness(friendly.manifest), []);
  assert.deepEqual(validateTemplateBundlePublishReadiness(premium.manifest), []);
});
