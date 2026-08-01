/**
 * Studio preview scaling.
 *
 * Fit and manual zoom have deliberately different contracts. Fit always shows
 * the complete artwork without scrollbars. Manual zoom prioritizes inspection
 * and becomes scrollable whenever the chosen scale exceeds the available area.
 */

/** Total padding (both edges) inside the preview viewport — Tailwind `p-4`. */
export const PREVIEW_VIEWPORT_PADDING = 32;

/** Manual zoom floor. Fit may go lower when a small viewport requires it. */
export const PREVIEW_MIN_SCALE = 0.1;

/** Canvas-style zoom ceiling. The authored 2× reference remains sharp here. */
export const PREVIEW_MAX_SCALE = 2;

/** Five percentage points matches familiar design-canvas zoom controls. */
export const PREVIEW_ZOOM_STEP = 0.05;

export type PreviewZoom = "fit" | number;

export function clampPreviewZoom(scale: number) {
  if (!Number.isFinite(scale)) return PREVIEW_MIN_SCALE;
  return Math.min(PREVIEW_MAX_SCALE, Math.max(PREVIEW_MIN_SCALE, scale));
}

export function stepPreviewZoom(scale: number, direction: -1 | 1) {
  const stepped =
    Math.round(scale / PREVIEW_ZOOM_STEP + direction) * PREVIEW_ZOOM_STEP;
  return clampPreviewZoom(Number(stepped.toFixed(2)));
}

/**
 * Largest scale at which the artwork fits entirely inside the viewport, capped
 * at 1 so small formats are never upscaled past their native size.
 */
export function previewFitScale(input: {
  availableWidth: number;
  availableHeight: number;
  width: number;
  height: number;
}) {
  if (input.width <= 0 || input.height <= 0) return 1;
  return Math.min(
    1,
    input.availableWidth / input.width,
    input.availableHeight / input.height,
  );
}

/**
 * Snap the displayed frame to whole CSS pixels. Fractional image sizes make
 * raster-locked Figma exports (logos, texture, baked layout) look soft while
 * overlaid live text remains crisp.
 */
function snapToWholePixels(width: number, scale: number) {
  return Math.max(1, Math.floor(width * scale)) / width;
}

/**
 * Resolve the scale actually applied to the canvas.
 *
 * `overflows` reports that a manually selected scale is larger than the
 * viewport. Fit uses the measured fit scale directly and never scrolls.
 */
export function resolvePreviewScale(input: {
  zoom: PreviewZoom;
  fitScale: number;
  width: number;
}): { scale: number; overflows: boolean } {
  const target =
    input.zoom === "fit" ? input.fitScale : clampPreviewZoom(input.zoom);
  const scale = snapToWholePixels(input.width, target);
  // Tolerance keeps float noise from reporting a scrollbar that never appears.
  return { scale, overflows: scale > input.fitScale + 1e-9 };
}

/**
 * Transform applied to the live (editable) template overlay.
 *
 * The overlay is laid out at `renderScale`× its nominal size so text metrics
 * match the fit service and the ImageResponse export, then scaled back down for
 * display. Composing this with the outer box must land on exactly the same
 * pixel width the outer box was given, or live text drifts away from the
 * artwork it sits on. See studio-preview-scale.test.ts.
 */
export function previewOverlayScale(scale: number, renderScale: number) {
  if (renderScale <= 0) return scale;
  return scale / renderScale;
}
