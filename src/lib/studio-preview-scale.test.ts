import assert from "node:assert/strict";
import test from "node:test";
import { TEMPLATE_OUTPUT_SIZES } from "./template-contract.ts";
import {
  PREVIEW_MIN_SCALE,
  PREVIEW_VIEWPORT_PADDING,
  previewFitScale,
  previewOverlayScale,
  resolvePreviewScale,
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

/**
 * Story is the named P1 launch requirement; a4, portrait and poster are the
 * other formats that fell below the floor before it existed.
 */
const ACCEPTANCE_FORMATS = ["story", "a4", "portrait", "poster"] as const;

function scaleFor(
  format: keyof typeof TEMPLATE_OUTPUT_SIZES,
  viewport: { width: number; height: number },
  zoom: "fit" | "half" | "full" = "fit",
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

test("acceptance formats stay at or above the readable floor on every required viewport", () => {
  for (const format of ACCEPTANCE_FORMATS) {
    for (const viewport of REQUIRED_VIEWPORTS) {
      const { scale } = scaleFor(format, viewport);
      assert.ok(
        scale >= PREVIEW_MIN_SCALE,
        `${format} at ${viewport.label} scaled to ${(scale * 100).toFixed(1)}%, below the ${PREVIEW_MIN_SCALE * 100}% floor`,
      );
    }
  }
});

test("story — the named P1 requirement — clears the floor at 1366x768", () => {
  const { scale, fitScale, overflows } = scaleFor("story", REQUIRED_VIEWPORTS[0]);
  // Unfloored fit is ~32% here, which is the defect this module exists to fix.
  assert.ok(fitScale < PREVIEW_MIN_SCALE, "expected raw fit to be below the floor");
  assert.equal(scale, PREVIEW_MIN_SCALE);
  assert.equal(overflows, true, "a floored canvas must be scrollable");
});

test("every format is readable at fit on every required viewport", () => {
  for (const format of Object.keys(TEMPLATE_OUTPUT_SIZES) as Array<
    keyof typeof TEMPLATE_OUTPUT_SIZES
  >) {
    for (const viewport of REQUIRED_VIEWPORTS) {
      const { scale } = scaleFor(format, viewport);
      assert.ok(scale >= PREVIEW_MIN_SCALE, `${format} at ${viewport.label}`);
    }
  }
});

test("formats that already fit above the floor are left untouched", () => {
  // Square fits at ~57% on the tightest viewport, so the floor must not alter it.
  const { scale, fitScale, overflows } = scaleFor("square", REQUIRED_VIEWPORTS[0]);
  assert.ok(fitScale > PREVIEW_MIN_SCALE);
  assert.equal(overflows, false, "artwork that fits must not scroll");
  assert.ok(Math.abs(scale - fitScale) < 0.001);
});

test("small formats are never upscaled past their native size", () => {
  const { scale } = scaleFor("leaderboard", REQUIRED_VIEWPORTS[2]);
  assert.equal(scale, 1);
});

test("explicit zoom levels override fit in both directions", () => {
  const viewport = REQUIRED_VIEWPORTS[0];
  assert.equal(scaleFor("story", viewport, "half").scale, 0.5);
  assert.equal(scaleFor("story", viewport, "full").scale, 1);
  // 100% on a format that would otherwise fit must still scroll.
  assert.equal(scaleFor("square", viewport, "full").overflows, true);
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
  for (const zoom of ["fit", "half", "full"] as const) {
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
