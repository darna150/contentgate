import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { buildContentGateTemplateBundle } from "./contentgate-bundle";
import {
  formatTemplatePlatformFitIssues,
  measureTemplatePlatformTextSlot,
  resolveTemplatePlatformVariantLayout,
  templatePlatformFieldFitIssues,
  templatePlatformFitInstructions,
} from "./fit";
import { isPublicContentGateBundle } from "./public-contentgate-assets";
import { validateTemplateBundlePublishReadiness } from "./publish-readiness";
import { renderTemplateBundleVariant } from "./render";
import { BACKGROUND_CHOICE_FIELD } from "./runtime";
import { validTemplateBundleManifest } from "./test-fixtures";

test("renders platform bundle generated mode with background and text slots", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_friendly");
  const rendered = renderTemplateBundleVariant({
    manifest: bundle.manifest,
    variantKey: "leaderboard",
    fields: {
      headline: "Carry lighter.",
      subheadline: "Technical carry for daily routes.",
      cta: "Explore",
    },
  });

  assert.ok(rendered);
  assert.equal(rendered.width, 728);
  assert.equal(rendered.height, 90);
  const html = renderToStaticMarkup(rendered.element);
  assert.match(html, /set-a\/backgrounds\/leaderboard\.png/);
  assert.match(html, /Carry lighter/);
  assert.match(html, /data-template-platform-bundle="aerform-air01-campaign"/);
  assert.match(html, /overflow:hidden/);
});

test("renders platform bundle with signed asset URLs when provided", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_friendly");
  const rendered = renderTemplateBundleVariant({
    manifest: bundle.manifest,
    variantKey: "leaderboard",
    fields: {},
    assetOrigin: "https://contentgate.example",
    assetUrlByPath: {
      "variants/leaderboard/background.png":
        "https://storage.example.test/signed-background.png",
    },
  });

  assert.ok(rendered);
  const html = renderToStaticMarkup(rendered.element);
  assert.match(
    html,
    /https:\/\/contentgate\.example\/template-packages\/contentgate\/set-a\/backgrounds\/leaderboard\.png\?v=aerform-campaign-/
  );
});

test("a shrink_to_fit slot renders at its resolved smaller size, not the authored max", async () => {
  const longHeadline = "Approved local marketing copy for every team";
  const textLayoutByField = await resolveTemplatePlatformVariantLayout({
    manifest: validTemplateBundleManifest,
    variantKey: "square",
    fields: { headline: longHeadline },
  });
  assert.ok(textLayoutByField.headline.fontSize < 72);

  const withResolvedLayout = renderTemplateBundleVariant({
    manifest: validTemplateBundleManifest,
    variantKey: "square",
    fields: { headline: longHeadline },
    textLayoutByField,
  });
  assert.ok(withResolvedLayout);
  const resolvedHtml = renderToStaticMarkup(withResolvedLayout.element);
  assert.match(resolvedHtml, new RegExp(`font-size:${textLayoutByField.headline.fontSize}px`));

  // Without a resolved layout, the slot falls back to the authored max —
  // confirms the shrink actually came from textLayoutByField, not some
  // other code path.
  const withoutResolvedLayout = renderTemplateBundleVariant({
    manifest: validTemplateBundleManifest,
    variantKey: "square",
    fields: { headline: longHeadline },
  });
  assert.ok(withoutResolvedLayout);
  const unresolvedHtml = renderToStaticMarkup(withoutResolvedLayout.element);
  assert.match(unresolvedHtml, /font-size:72px/);
});

test("renders selected designer-approved background option in generated mode", () => {
  const rendered = renderTemplateBundleVariant({
    manifest: validTemplateBundleManifest,
    variantKey: "square",
    fields: {
      headline: "Background option test",
      [BACKGROUND_CHOICE_FIELD]: "warm",
    },
  });

  assert.ok(rendered);
  const html = renderToStaticMarkup(rendered.element);
  assert.match(html, /variants\/square\/background-alt\.png/);
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

test("ContentGate figwright bundles use versioned public assets for browser and export renders", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_friendly");
  const manifest = {
    ...bundle.manifest,
    version: {
      ...bundle.manifest.version,
      name: "figwright-v1",
    },
    assets: bundle.manifest.assets.map((asset) =>
      asset.path.includes("variants/leaderboard/background.png")
        ? {
            ...asset,
            path: "variants/leaderboard/background.png",
          }
        : asset.path.includes("template-packages/contentgate/set-a/leaderboard.png")
          ? {
              ...asset,
              path: "variants/leaderboard/reference.png",
            }
          : asset
    ),
  };

  const browserRendered = renderTemplateBundleVariant({
    manifest,
    variantKey: "leaderboard",
    fields: {},
  });
  assert.ok(browserRendered);
  assert.match(
    renderToStaticMarkup(browserRendered.element),
    /\/template-packages\/contentgate\/set-a\/backgrounds\/leaderboard\.png\?v=aerform-campaign-/
  );

  const exportRendered = renderTemplateBundleVariant({
    manifest,
    variantKey: "leaderboard",
    fields: {},
    assetOrigin: "https://contentgate.example",
  });
  assert.ok(exportRendered);
  assert.match(
    renderToStaticMarkup(exportRendered.element),
    /https:\/\/contentgate\.example\/template-packages\/contentgate\/set-a\/backgrounds\/leaderboard\.png\?v=aerform-campaign-/
  );
});

test("ContentGate figwright bundles render true 2x exports with high-density assets", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_friendly");
  const manifest = {
    ...bundle.manifest,
    version: {
      ...bundle.manifest.version,
      name: "figwright-v1",
    },
    assets: bundle.manifest.assets.map((asset) =>
      asset.path.includes("template-packages/contentgate/set-a/backgrounds/medium-rectangle.png")
        ? {
            ...asset,
            path: "variants/medium_rectangle/background.png",
          }
        : asset
    ),
  };

  const rendered = renderTemplateBundleVariant({
    manifest,
    variantKey: "medium_rectangle",
    fields: { headline: "Crisp QA export" },
    assetOrigin: "https://contentgate.example",
    scale: 2,
  });

  assert.ok(rendered);
  assert.equal(rendered.width, 600);
  assert.equal(rendered.height, 500);
  const html = renderToStaticMarkup(rendered.element);
  assert.match(
    html,
    /https:\/\/contentgate\.example\/template-packages\/contentgate\/set-a\/backgrounds\/medium-rectangle@2x\.png\?v=aerform-campaign-/
  );
  assert.match(html, /font-size:\d+(?:\.\d+)?px/);
});

test("ContentGate figwright bundles also support legacy public package asset paths", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_friendly");
  const manifest = {
    ...bundle.manifest,
    version: {
      ...bundle.manifest.version,
      name: "figwright-v1",
    },
  };

  const rendered = renderTemplateBundleVariant({
    manifest,
    variantKey: "leaderboard",
    fields: {},
    assetUrlByPath: {
      "variants/leaderboard/background.png":
        "https://storage.example.test/signed-background.png",
    },
  });

  assert.ok(rendered);
  const html = renderToStaticMarkup(rendered.element);
  assert.match(
    html,
    /\/template-packages\/contentgate\/set-a\/backgrounds\/leaderboard\.png\?v=aerform-campaign-/
  );
  assert.doesNotMatch(html, /storage\.example\.test/);
});

test("ContentGate figwright bundles are recognized as public assets", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_friendly");
  const manifest = {
    ...bundle.manifest,
    version: {
      ...bundle.manifest.version,
      name: "figwright-v1",
    },
  };

  assert.equal(isPublicContentGateBundle(manifest), true);
});

test("generated bundle renders with absolute assets for ImageResponse consumption", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_friendly");
  const rendered = renderTemplateBundleVariant({
    manifest: bundle.manifest,
    variantKey: "link_ad",
    fields: {
      cta: "Explore",
      headline: "Carry lighter.\nMove quieter.",
      subheadline: "Technical carry for commute and travel.",
    },
    assetOrigin: "https://contentgate.example",
  });

  assert.ok(rendered);
  const html = renderToStaticMarkup(rendered.element);
  assert.match(
    html,
    /https:\/\/contentgate\.example\/template-packages\/contentgate\/set-a\/backgrounds\/link-ad\.png\?v=aerform-campaign-/
  );
  assert.match(
    html,
    /https:\/\/contentgate\.example\/template-packages\/contentgate\/products\/charcoal\.png/
  );
});

test("ContentGate link ad headlines reserve descender-safe line boxes", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_friendly");
  const fields = {
    cta: "Get started",
    headline: "Carry lighter.\nMove quieter.",
    subheadline: "Technical carry for commute and travel.",
  };
  const issues = await templatePlatformFieldFitIssues({
    manifest: bundle.manifest,
    variantKey: "link_ad",
    fields,
  });
  assert.deepEqual(issues.headline ?? [], []);

  const rendered = renderTemplateBundleVariant({
    manifest: bundle.manifest,
    variantKey: "link_ad",
    fields,
  });
  assert.ok(rendered);
  const html = renderToStaticMarkup(rendered.element);
  assert.match(html, /Carry lighter/);
  assert.match(html, /line-height:1.2400000095367432/);
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

test("fit measurement includes letter spacing from the Figma text slot", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_friendly");
  const variant = bundle.manifest.variants.find((item) => item.key === "leaderboard");
  const slot = variant?.slots.find(
    (item) => item.kind === "text" && item.field === "headline"
  );
  assert.ok(slot && slot.kind === "text");

  const withoutLetterSpacing = await measureTemplatePlatformTextSlot(
    bundle.manifest,
    "Brand",
    { ...slot, letterSpacing: 0 }
  );
  const withLetterSpacing = await measureTemplatePlatformTextSlot(
    bundle.manifest,
    "Brand",
    { ...slot, letterSpacing: 8 }
  );

  assert.ok(
    withLetterSpacing.lineWidths[0] > withoutLetterSpacing.lineWidths[0] + 24
  );
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
