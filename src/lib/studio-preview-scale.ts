/**
 * Studio preview scaling.
 *
 * Studio previews used to fit the artwork to both axes with no lower bound. On
 * the required review viewports that collapsed tall formats to an unreadable
 * size — a 1080×1920 story lands at 32% on 1366×768, and no amount of chrome
 * trimming reaches 50% (the format needs a 1112px-tall viewport to fit at 50%).
 *
 * So "fit" is floored at PREVIEW_MIN_SCALE and the viewport scrolls whenever the
 * floor wins. Formats that already fit above the floor are unaffected.
 */

/** Total padding (both edges) inside the preview viewport — Tailwind `p-4`. */
export const PREVIEW_VIEWPORT_PADDING = 32;

/** Reviewers must never be shown artwork below this scale. */
export const PREVIEW_MIN_SCALE = 0.5;

export type PreviewZoom = "fit" | "half" | "full";

export const PREVIEW_ZOOM_OPTIONS: ReadonlyArray<{
  value: PreviewZoom;
  label: string;
}> = [
  { value: "fit", label: "Fit" },
  { value: "half", label: "50%" },
  { value: "full", label: "100%" },
];

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
 * `overflows` reports that the artwork is larger than the viewport and the
 * container must therefore scroll — it is the floor doing its job, not a bug.
 */
export function resolvePreviewScale(input: {
  zoom: PreviewZoom;
  fitScale: number;
  width: number;
}): { scale: number; overflows: boolean } {
  const target =
    input.zoom === "fit"
      ? Math.max(input.fitScale, PREVIEW_MIN_SCALE)
      : input.zoom === "half"
        ? PREVIEW_MIN_SCALE
        : 1;
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
