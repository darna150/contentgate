import React from "react";

import type { TemplateBundleManifest, TemplateBundleTextSlot } from "./manifest";
import {
  templateBundleFontStack,
  templateBundleFontStyle,
  templateBundleFontWeight,
} from "./fonts";
import { publicContentGateBundleAssetPath } from "./public-contentgate-assets";
import {
  BACKGROUND_CHOICE_FIELD,
  resolveTemplateBundleRuntimeVariant,
} from "./runtime";

export type TemplateBundleRenderResult = {
  element: React.ReactElement;
  width: number;
  height: number;
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function descenderPadding(slot: TemplateBundleTextSlot, fontSize: number, scale = 1) {
  // Figma text boxes can export very tight line-height values (< 1).
  // Browser/Satori rendering can then clip glyph descenders ("g", "y",
  // "p", "q") when the slot clips overflow. Preserve the Figma line
  // height, but use any spare vertical room as a small internal descender
  // buffer so glyph bottoms are not cut off.
  const lineBoxHeight = fontSize * slot.lineHeight * slot.maxLines;
  return Math.max(0, Math.min(fontSize * 0.12, scaledNumber(slot.height, scale) - lineBoxHeight));
}

/**
 * A pre-resolved font size + explicit line breaks for one text slot, as
 * produced by resolveTemplatePlatformVariantLayout / resolveTemplatePlatformTextSlotLayout
 * in fit.ts. When supplied, the slot renders exactly these lines at exactly
 * this size instead of letting Satori re-wrap the raw field text — this is
 * what makes "shrink_to_fit" slots actually shrink instead of clipping.
 */
export type TemplateBundleTextLayout = {
  fontSize: number;
  lines: string[];
};

function scaledNumber(value: number, scale: number) {
  return Math.round(value * scale * 1000) / 1000;
}

function fallbackFontSizeForUnresolvedText(
  slot: TemplateBundleTextSlot,
  text: string,
  scale: number
) {
  const maxSize = slot.fontSize;
  const minSize = slot.fit === "shrink_to_fit" && slot.minFontSize ? slot.minFontSize : maxSize;
  const lineCapacity = Math.max(1, (slot.lineChars ?? slot.maxChars ?? 18) * slot.maxLines);
  const meaningfulLength = Math.max(1, text.replace(/\s+/g, " ").trim().length);
  if (meaningfulLength <= lineCapacity) return scaledNumber(maxSize, scale);
  const ratio = lineCapacity / meaningfulLength;
  const estimatedSize = Math.max(minSize, maxSize * Math.sqrt(ratio));
  return scaledNumber(estimatedSize, scale);
}

function renderTextSlot(
  manifest: TemplateBundleManifest,
  slot: TemplateBundleTextSlot,
  fields: Record<string, unknown>,
  layoutByField?: Record<string, TemplateBundleTextLayout>,
  scale = 1
) {
  const resolved = layoutByField?.[slot.field];
  const content = resolved ? resolved.lines.join("\n") : cleanText(fields[slot.field]);
  const fontSize = resolved
    ? scaledNumber(resolved.fontSize, scale)
    : fallbackFontSizeForUnresolvedText(slot, content, scale);
  const horizontalAlign =
    slot.align === "center" ? "center" : slot.align === "right" ? "flex-end" : "flex-start";

  return (
    <div
      key={slot.key}
      data-template-field={slot.field}
      data-template-max-lines={slot.maxLines}
      data-template-font-size={fontSize}
      style={{
        position: "absolute",
        left: scaledNumber(slot.x, scale),
        top: scaledNumber(slot.y, scale),
        width: scaledNumber(slot.width, scale),
        height: scaledNumber(slot.height, scale),
        overflow: "hidden",
        color: slot.color,
        display: "flex",
        flexDirection: "column",
        fontFamily: templateBundleFontStack(manifest, slot),
        fontSize,
        fontWeight: templateBundleFontWeight(manifest, slot),
        fontStyle: templateBundleFontStyle(manifest, slot),
        lineHeight: slot.lineHeight,
        letterSpacing: scaledNumber(slot.letterSpacing ?? 0, scale),
        textAlign: slot.align ?? "left",
        whiteSpace: "pre-wrap",
        alignItems: horizontalAlign,
        justifyContent:
          slot.verticalAlign === "top"
            ? "flex-start"
            : slot.verticalAlign === "bottom"
              ? "flex-end"
              : "center",
      }}
    >
      <span
        data-template-content
        style={{
          display: resolved ? "block" : "-webkit-box",
          maxWidth: "100%",
          minWidth: 0,
          flexShrink: 0,
          maxHeight: "100%",
          paddingBottom: descenderPadding(slot, fontSize, scale),
          overflow: "hidden",
          textAlign: slot.align ?? "left",
          whiteSpace: resolved ? "pre-wrap" : "normal",
          wordBreak: "normal",
          overflowWrap: resolved ? "normal" : "break-word",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: resolved ? resolved.lines.length : slot.maxLines,
        }}
      >
        {content}
      </span>
    </div>
  );
}

function resolveImageSource(
  manifest: TemplateBundleManifest,
  path: string,
  assetUrlByPath?: Record<string, string>,
  assetOrigin?: string
) {
  const publicPath = publicContentGateBundleAssetPath(manifest, path);
  if (publicPath) {
    return assetOrigin ? new URL(publicPath, assetOrigin).toString() : publicPath;
  }
  const signedUrl = assetUrlByPath?.[path];
  if (signedUrl) return signedUrl;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) {
    return path;
  }
  return `/${path}`;
}

function highDensityImageSource(src: string) {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    const url = new URL(src);
    if (!url.pathname.toLowerCase().endsWith(".png")) return null;
    url.pathname = url.pathname.replace(/\.png$/i, "@2x.png");
    return url.toString();
  }
  if (!src.startsWith("/")) return null;
  const [pathname, query = ""] = src.split("?");
  if (!pathname.toLowerCase().endsWith(".png")) return null;
  return `${pathname.replace(/\.png$/i, "@2x.png")}${query ? `?${query}` : ""}`;
}

export function renderTemplateBundleVariant(input: {
  manifest: TemplateBundleManifest;
  variantKey: string;
  fields: Record<string, unknown>;
  assetUrlByPath?: Record<string, string>;
  assetOrigin?: string;
  original?: boolean;
  /** Pre-resolved {fontSize, lines} per field, from fit.ts. Optional so
   * callers that haven't resolved layout (or slots with fit: "fixed") fall
   * back to raw-text CSS wrap/clamp at the authored fontSize. */
  textLayoutByField?: Record<string, TemplateBundleTextLayout>;
  scale?: 1 | 2;
}): TemplateBundleRenderResult | null {
  const scale = input.scale ?? 1;
  const selectedBackgroundKey =
    typeof input.fields[BACKGROUND_CHOICE_FIELD] === "string"
      ? String(input.fields[BACKGROUND_CHOICE_FIELD])
      : undefined;
  const runtime = resolveTemplateBundleRuntimeVariant(
    input.manifest,
    input.variantKey,
    selectedBackgroundKey
  );
  if (!runtime) return null;
  const imagePath = input.original
    ? runtime.referenceAssetPath
    : runtime.backgroundAssetPath;
  const imageSrc = resolveImageSource(
    input.manifest,
    imagePath,
    input.assetUrlByPath,
    input.assetOrigin
  );
  const imageSrc2x = highDensityImageSource(imageSrc);
  const displayImageSrc = scale > 1 && imageSrc2x ? imageSrc2x : imageSrc;
  const width = runtime.variant.width * scale;
  const height = runtime.variant.height * scale;

  return {
    width,
    height,
    element: (
      <div
        data-template-platform-bundle={input.manifest.family.key}
        style={{
          position: "relative",
          display: "flex",
          width,
          height,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displayImageSrc}
          srcSet={scale === 1 && imageSrc2x ? `${imageSrc} 1x, ${imageSrc2x} 2x` : undefined}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: "fill",
          }}
        />
        {!input.original &&
          runtime.variant.slots
            .filter((slot): slot is TemplateBundleTextSlot => slot.kind === "text")
            .map((slot) =>
              renderTextSlot(
                input.manifest,
                slot,
                input.fields,
                input.textLayoutByField,
                scale
              )
            )}
      </div>
    ),
  };
}
