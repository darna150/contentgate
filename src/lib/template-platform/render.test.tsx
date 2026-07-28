import assert from "node:assert/strict";
import test from "node:test";
import { ImageResponse } from "next/og";
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
import { loadTemplateBundleImageFonts } from "./server-fonts";
import { validTemplateBundleManifest } from "./test-fixtures";

test("renders platform bundle generated mode with background and text slots", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_premium");
  const rendered = renderTemplateBundleVariant({
    manifest: bundle.manifest,
    variantKey: "portrait",
    fields: {
      headline: "On-brand local content",
      subheadline: "Approved templates for every team",
      cta: "Learn more",
    },
  });

  assert.ok(rendered);
  assert.equal(rendered.width, 1080);
  assert.equal(rendered.height, 1350);
  const html = renderToStaticMarkup(rendered.element);
  assert.match(html, /set-b\/backgrounds\/portrait\.png/);
  assert.match(html, /On-brand local content/);
  assert.match(html, /data-template-platform-bundle="contentgate-local-premium"/);
  assert.match(html, /overflow:hidden/);
});

test("renders platform bundle with signed asset URLs when provided", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_premium");
  const rendered = renderTemplateBundleVariant({
    manifest: bundle.manifest,
    variantKey: "portrait",
    fields: {},
    assetUrlByPath: {
      "template-packages/contentgate/set-b/backgrounds/portrait.png":
        "https://storage.example.test/signed-background.png",
    },
  });

  assert.ok(rendered);
  const html = renderToStaticMarkup(rendered.element);
  assert.match(html, /https:\/\/storage\.example\.test\/signed-background\.png/);
});

test("does not invent an @2x sibling for a signed storage object", () => {
  const signedUrl =
    "https://example.supabase.co/storage/v1/object/sign/template-bundles/path/background.png?token=secret";
  const rendered = renderTemplateBundleVariant({
    manifest: validTemplateBundleManifest,
    variantKey: "square",
    fields: {},
    assetUrlByPath: { "variants/square/background.png": signedUrl },
    scale: 2,
  });

  assert.ok(rendered);
  const html = renderToStaticMarkup(rendered.element);
  assert.match(html, /background\.png\?token=secret/);
  assert.doesNotMatch(html, /background@2x\.png/);
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
  const bundle = await buildContentGateTemplateBundle("contentgate_local_premium");
  const rendered = renderTemplateBundleVariant({
    manifest: bundle.manifest,
    variantKey: "portrait",
    fields: {
      headline: "Hidden in original mode",
    },
    original: true,
  });

  assert.ok(rendered);
  const html = renderToStaticMarkup(rendered.element);
  assert.match(html, /set-b\/portrait\.png/);
  assert.doesNotMatch(html, /Hidden in original mode/);
});

test("ContentGate figwright bundles use versioned public assets for browser and export renders", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_premium");
  const manifest = {
    ...bundle.manifest,
    version: {
      ...bundle.manifest.version,
      name: "figwright-v1",
    },
    assets: bundle.manifest.assets.map((asset) =>
      asset.path.includes("template-packages/contentgate/set-b/backgrounds/portrait.png")
        ? {
            ...asset,
            path: "variants/portrait/background.png",
          }
        : asset.path.includes("template-packages/contentgate/set-b/portrait.png")
          ? {
              ...asset,
              path: "variants/portrait/reference.png",
            }
          : asset
    ),
  };

  const browserRendered = renderTemplateBundleVariant({
    manifest,
    variantKey: "portrait",
    fields: {},
  });
  assert.ok(browserRendered);
  assert.match(
    renderToStaticMarkup(browserRendered.element),
    /\/template-bundles\/contentgate-local-premium\/figwright-v1\/variants\/portrait\/background\.png\?v=vector-figwright-/
  );

  const exportRendered = renderTemplateBundleVariant({
    manifest,
    variantKey: "portrait",
    fields: {},
    assetOrigin: "https://contentgate.example",
  });
  assert.ok(exportRendered);
  assert.match(
    renderToStaticMarkup(exportRendered.element),
    /https:\/\/contentgate\.example\/template-bundles\/contentgate-local-premium\/figwright-v1\/variants\/portrait\/background\.png\?v=vector-figwright-/
  );
});

test("ContentGate figwright bundles render true 2x exports with high-density assets", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_premium");
  const manifest = {
    ...bundle.manifest,
    version: {
      ...bundle.manifest.version,
      name: "figwright-v1",
    },
    assets: bundle.manifest.assets.map((asset) =>
      asset.path.includes("template-packages/contentgate/set-b/backgrounds/medium-rectangle.png")
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
    /https:\/\/contentgate\.example\/template-bundles\/contentgate-local-premium\/figwright-v1\/variants\/medium_rectangle\/background@2x\.png\?v=vector-figwright-/
  );
  assert.match(html, /font-size:\d+(?:\.\d+)?px/);
});

test("ContentGate figwright bundles also support legacy public package asset paths", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_premium");
  const manifest = {
    ...bundle.manifest,
    version: {
      ...bundle.manifest.version,
      name: "figwright-v1",
    },
  };

  const rendered = renderTemplateBundleVariant({
    manifest,
    variantKey: "portrait",
    fields: {},
    assetUrlByPath: {
      "template-packages/contentgate/set-b/backgrounds/portrait.png":
        "https://storage.example.test/signed-background.png",
    },
  });

  assert.ok(rendered);
  const html = renderToStaticMarkup(rendered.element);
  assert.match(
    html,
    /\/template-bundles\/contentgate-local-premium\/figwright-v1\/variants\/portrait\/background\.png\?v=vector-figwright-/
  );
  assert.doesNotMatch(html, /storage\.example\.test/);
});

test("ContentGate figwright bundles are recognized as public assets", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_premium");
  const manifest = {
    ...bundle.manifest,
    version: {
      ...bundle.manifest.version,
      name: "figwright-v1",
    },
  };

  assert.equal(isPublicContentGateBundle(manifest), true);
});

test("generated bundle renders can be consumed by ImageResponse", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_premium");
  const backgroundPath = "template-packages/contentgate/set-b/backgrounds/link-ad.png";
  const rendered = renderTemplateBundleVariant({
    manifest: bundle.manifest,
    variantKey: "link_ad",
    fields: {
      cta: "Get Started Today",
      headline: "Local Content,\nBrand Approved",
      local_detail: "Your local team. Your brand. Ready to go.",
      proof_note: "Trusted by branch teams,\nfranchises & field reps.",
      subheadline:
        "Create on-brand local marketing from approved templates—without breaking the design system.",
    },
    assetUrlByPath: {
      [backgroundPath]:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    },
  });

  assert.ok(rendered);

  const fonts = await loadTemplateBundleImageFonts({ manifest: bundle.manifest });
  const response = new ImageResponse(rendered.element, {
    width: rendered.width,
    height: rendered.height,
    fonts,
  });
  const png = await response.arrayBuffer();

  assert.equal(response.headers.get("content-type"), "image/png");
  assert.ok(png.byteLength > 0);
});

test("ContentGate link ad headlines reserve descender-safe line boxes", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_premium");
  const fields = {
    cta: "Get started",
    headline: "Share your offer—\nready to go",
    local_detail: "Create local link ads faster",
    proof_note: "Editable fields guided by locked templates",
    subheadline: "Local edits from approved templates, assets, and product knowledge.",
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
  assert.match(html, /Share your offer/);
  assert.match(html, /line-height:1.04/);
});

test("reports platform copy that wraps beyond the locked text slot", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_premium");
  const issues = await templatePlatformFieldFitIssues({
    manifest: bundle.manifest,
    variantKey: "medium_rectangle",
    fields: {
      headline: "Unfit headline ".repeat(20),
      subheadline: "Unfit supporting copy ".repeat(30),
      cta: "Learn how it works",
    },
  });

  const messages = formatTemplatePlatformFitIssues(issues);
  assert.equal(messages.some((message) => message.includes("headline")), true);
  assert.equal(messages.some((message) => message.includes("subheadline")), true);
});

test("fit measurement includes letter spacing from the Figma text slot", async () => {
  const bundle = await buildContentGateTemplateBundle("contentgate_local_premium");
  const variant = bundle.manifest.variants.find((item) => item.key === "portrait");
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
  const bundle = await buildContentGateTemplateBundle("contentgate_local_premium");
  const instructions = templatePlatformFitInstructions({
    manifest: bundle.manifest,
    variantKey: "portrait",
  });

  assert.equal(instructions.some((line) => line.includes("headline")), true);
  assert.equal(instructions.some((line) => line.includes("px-wide")), true);
});

test("generated ContentGate platform bundle passes the publish-readiness gate", async () => {
  const premium = await buildContentGateTemplateBundle("contentgate_local_premium");
  assert.deepEqual(validateTemplateBundlePublishReadiness(premium.manifest), []);
});
