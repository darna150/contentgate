import assert from "node:assert/strict";
import test from "node:test";
import { TEMPLATE_OUTPUT_SIZES } from "./template-contract.ts";
import {
  PREVIEW_MIN_SCALE,
  PREVIEW_MAX_SCALE,
  PREVIEW_VIEWPORT_PADDING,
  clampPreviewZoom,
  previewFitScale,
  previewOverlayScale,
  resolvePreviewScale,
  stepPreviewZoom,
  type PreviewZoom,
} from "./studio-preview-scale.ts";

/**
 * Studio chrome consumed before the preview viewport gets any space. Derived
 * from source, not guessed:
 *   app header   h-[56px]                     studio-workspace.tsx
 *   toolbar      min-h-[64px]                 studio-toolbar.tsx
 *   left aside   minmax(340px, 400px)         studio-workspace.tsx
 *   viewport pad p-4 -> 32px per axis         studio-preview.tsx
 */
const HEADER = 56;
const TOOLBAR = 64;
const ASIDE = 400;

/** Review viewports the launch acceptance matrix requires. */
const REQUIRED_VIEWPORTS = [
  { label: "1366x768", width: 1366, height: 768 },
  { label: "1280x800", width: 1280, height: 800 },
  { label: "1440x900", width: 1440, height: 900 },
] as const;

/** Tall formats exercise the height-bound fit path. */
const ACCEPTANCE_FORMATS = ["story", "a4", "portrait", "poster"] as const;

function scaleFor(
  format: keyof typeof TEMPLATE_OUTPUT_SIZES,
  viewport: { width: number; height: number },
  zoom: PreviewZoom = "fit",
) {
  const { w: width, h: height } = TEMPLATE_OUTPUT_SIZES[format];
  const fitScale = previewFitScale({
    availableWidth: viewport.width - ASIDE - PREVIEW_VIEWPORT_PADDING,
    availableHeight: viewport.height - HEADER - TOOLBAR - PREVIEW_VIEWPORT_PADDING,
    width,
    height,
  });
  return { ...resolvePreviewScale({ zoom, fitScale, width }), fitScale, width, height };
}

test("fit shows every acceptance format without scrolling", () => {
  for (const format of ACCEPTANCE_FORMATS) {
    for (const viewport of REQUIRED_VIEWPORTS) {
      const { scale, fitScale, overflows } = scaleFor(format, viewport);
      assert.ok(scale <= fitScale, `${format} at ${viewport.label} exceeded fit`);
      assert.equal(overflows, false, `${format} at ${viewport.label} scrolled on fit`);
    }
  }
});

test("story uses its measured fit below 50% instead of forcing scroll", () => {
  const { scale, fitScale, overflows } = scaleFor("story", REQUIRED_VIEWPORTS[0]);
  assert.ok(fitScale < 0.5, "expected story fit to be below 50%");
  assert.ok(Math.abs(scale - fitScale) < 0.001);
  assert.equal(overflows, false);
});

test("every format fits completely on every required viewport", () => {
  for (const format of Object.keys(TEMPLATE_OUTPUT_SIZES) as Array<
    keyof typeof TEMPLATE_OUTPUT_SIZES
  >) {
    for (const viewport of REQUIRED_VIEWPORTS) {
      const { scale, fitScale, overflows } = scaleFor(format, viewport);
      assert.ok(scale <= fitScale, `${format} at ${viewport.label}`);
      assert.equal(overflows, false, `${format} at ${viewport.label}`);
    }
  }
});

test("fit scale is left untouched apart from whole-pixel snapping", () => {
  const { scale, fitScale, overflows } = scaleFor("square", REQUIRED_VIEWPORTS[0]);
  assert.equal(overflows, false, "artwork that fits must not scroll");
  assert.ok(Math.abs(scale - fitScale) < 0.001);
});

test("small formats are never upscaled past their native size", () => {
  const { scale } = scaleFor("leaderboard", REQUIRED_VIEWPORTS[2]);
  assert.equal(scale, 1);
});

test("continuous zoom levels override fit and remain bounded", () => {
  const viewport = REQUIRED_VIEWPORTS[0];
  assert.equal(scaleFor("story", viewport, 0.5).scale, 0.5);
  assert.equal(scaleFor("story", viewport, 1).scale, 1);
  assert.equal(scaleFor("story", viewport, 2).scale, 2);
  // 100% on a format that would otherwise fit must still scroll.
  assert.equal(scaleFor("square", viewport, 1).overflows, true);
  assert.equal(clampPreviewZoom(0.01), PREVIEW_MIN_SCALE);
  assert.equal(clampPreviewZoom(4), PREVIEW_MAX_SCALE);
});

test("zoom buttons step in five-point increments", () => {
  assert.equal(stepPreviewZoom(0.5, 1), 0.55);
  assert.equal(stepPreviewZoom(0.55, -1), 0.5);
  assert.equal(stepPreviewZoom(PREVIEW_MAX_SCALE, 1), PREVIEW_MAX_SCALE);
});

test("displayed width always lands on whole pixels", () => {
  for (const format of Object.keys(TEMPLATE_OUTPUT_SIZES) as Array<
    keyof typeof TEMPLATE_OUTPUT_SIZES
  >) {
    for (const viewport of REQUIRED_VIEWPORTS) {
      const { scale, width } = scaleFor(format, viewport);
      const displayed = width * scale;
      // Snapping divides by width and the caller multiplies back, so allow for
      // IEEE-754 noise (476.00000000000006). Callers round for layout.
      assert.ok(
        Math.abs(displayed - Math.round(displayed)) < 1e-6,
        `${format} at ${viewport.label} displayed at ${displayed}px`,
      );
    }
  }
});

/**
 * The editable text-overlay path. The overlay renders at renderScale× and is
 * transformed back down; if that composition drifts from the outer box, live
 * text separates from the artwork underneath it.
 */
test("editable overlay composes to exactly the outer frame width at every zoom", () => {
  const renderScale = 2;
  for (const zoom of ["fit", 0.5, 1, 1.5] as const) {
    for (const format of ACCEPTANCE_FORMATS) {
      for (const viewport of REQUIRED_VIEWPORTS) {
        const { scale, width, height } = scaleFor(format, viewport, zoom);
        const outerWidth = Math.round(width * scale);
        const outerHeight = Math.round(height * scale);

        // The overlay is laid out at renderScale× nominal, then transformed.
        const overlay = previewOverlayScale(scale, renderScale);
        const composedWidth = Math.round(width * renderScale * overlay);
        const composedHeight = Math.round(height * renderScale * overlay);

        assert.equal(
          composedWidth,
          outerWidth,
          `${format} ${zoom} at ${viewport.label}: overlay width drifted`,
        );
        assert.equal(
          composedHeight,
          outerHeight,
          `${format} ${zoom} at ${viewport.label}: overlay height drifted`,
        );
      }
    }
  }
});

test("overlay scale degrades safely if renderScale is absent", () => {
  assert.equal(previewOverlayScale(0.5, 0), 0.5);
});
