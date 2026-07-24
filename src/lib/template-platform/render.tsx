import React from "react";

import type {
  TemplateBundleImageSlot,
  TemplateBundleManifest,
  TemplateBundleTextSlot,
} from "./manifest";
import { selectedTemplateAssetUrl } from "./dam-bindings";
import {
  templateBundleFontStack,
  templateBundleFontStyle,
  templateBundleFontWeight,
} from "./fonts";
import {
  isPublicContentGateBundle,
  publicContentGateBundleAssetPath,
} from "./public-contentgate-assets";
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
  scale = 1,
  colorOverride?: string
) {
  const resolved = layoutByField?.[slot.field];
  const content = resolved ? resolved.lines.join("\n") : cleanText(fields[slot.field]);
  const fontSize = resolved
    ? scaledNumber(resolved.fontSize, scale)
    : fallbackFontSizeForUnresolvedText(slot, content, scale);
  const horizontalAlign =
    slot.align === "center" ? "center" : slot.align === "right" ? "flex-end" : "flex-start";
  const lineHeight =
    slot.field === "headline" && slot.maxLines > 1
      ? Math.max(slot.lineHeight, 1.2400000095367432)
      : slot.lineHeight;

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
        color: colorOverride ?? slot.color,
        display: "flex",
        flexDirection: "column",
        fontFamily: templateBundleFontStack(manifest, slot),
        fontSize,
        fontWeight: templateBundleFontWeight(manifest, slot),
        fontStyle: templateBundleFontStyle(manifest, slot),
        lineHeight,
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

const PRODUCT_VARIANT_FIELD = "__productVariantKey";

const DARK_BACKGROUND_KEYS = new Set(["terracotta-edge", "night-threshold", "dark-performance"]);

// Resolve the selected product-variant image from the manifest's registered
// image assets (path convention `products/<key>.png`, or a matching asset key),
// signed through assetUrlByPath like every other bundle asset. Bundles that
// declare no product variants simply have no matching asset and render nothing.
function selectedProductAsset(
  manifest: TemplateBundleManifest,
  fields: Record<string, unknown>,
  assetUrlByPath?: Record<string, string>,
  assetOrigin?: string
) {
  const field = manifest.fields.find((item) => item.key === PRODUCT_VARIANT_FIELD);
  const selected = fields[PRODUCT_VARIANT_FIELD];
  const key =
    (typeof selected === "string" && selected) ||
    (typeof field?.defaultValue === "string" ? field.defaultValue : undefined) ||
    field?.options?.[0];
  if (!key) return null;
  const asset = manifest.assets.find(
    (item) =>
      item.kind === "image" &&
      (item.key === `product-${key}` ||
        item.path === `products/${key}.png` ||
        item.path.endsWith(`/${key}.png`))
  );
  if (!asset) return null;
  if (isPublicContentGateBundle(manifest) && asset.path === `products/${key}.png`) {
    const publicProductPath = `/template-packages/contentgate/products/${key}.png`;
    return assetOrigin ? new URL(publicProductPath, assetOrigin).toString() : publicProductPath;
  }
  return resolveImageSource(manifest, asset.path, assetUrlByPath, assetOrigin);
}

function renderImageSlot(
  slot: TemplateBundleImageSlot,
  manifest: TemplateBundleManifest,
  fields: Record<string, unknown>,
  assetUrlByPath?: Record<string, string>,
  damAssetUrlById?: Record<string, string>,
  scale = 1,
  assetOrigin?: string
) {
  const damSrc = selectedTemplateAssetUrl({
    field: manifest.fields.find((field) => field.key === slot.field),
    selectedValue: fields[slot.field],
    damAssetUrlById,
  });
  const src =
    damSrc ??
    (slot.field === PRODUCT_VARIANT_FIELD
      ? selectedProductAsset(manifest, fields, assetUrlByPath, assetOrigin)
      : cleanText(fields[slot.field]));
  if (!src) return null;
  const shadowWidth = scaledNumber(slot.width * 0.68, scale);
  const shadowHeight = scaledNumber(Math.max(10, slot.height * 0.085), scale);
  const shadowLeft = scaledNumber(slot.x + slot.width * 0.16, scale);
  const shadowTop = scaledNumber(slot.y + slot.height * 0.87, scale);
  return (
    <React.Fragment key={slot.key}>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: shadowLeft,
          top: shadowTop,
          width: shadowWidth,
          height: shadowHeight,
          borderRadius: "50%",
          background: "rgba(0,0,0,.34)",
          filter: `blur(${scaledNumber(Math.max(4, slot.width * 0.035), scale)}px)`,
          transform: "translateY(12%)",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        data-template-field={slot.field}
        style={{
          position: "absolute",
          left: scaledNumber(slot.x, scale),
          top: scaledNumber(slot.y, scale),
          width: scaledNumber(slot.width, scale),
          height: scaledNumber(slot.height, scale),
          display: "block",
          objectFit: slot.fit,
          transform: slot.rotation ? `rotate(${slot.rotation}deg)` : undefined,
        }}
      />
    </React.Fragment>
  );
}

function resolveImageSource(
  manifest: TemplateBundleManifest,
  path: string,
  assetUrlByPath?: Record<string, string>,
  assetOrigin?: string
) {
  const signedUrl = assetUrlByPath?.[path];
  if (signedUrl && !isPublicContentGateBundle(manifest)) return signedUrl;
  const publicPath = publicContentGateBundleAssetPath(manifest, path);
  if (publicPath) {
    return assetOrigin ? new URL(publicPath, assetOrigin).toString() : publicPath;
  }
  if (signedUrl) return signedUrl;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) {
    return assetOrigin && path.startsWith("/")
      ? new URL(path, assetOrigin).toString()
      : path;
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
  damAssetUrlById?: Record<string, string>;
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
  const textColorOverride = selectedBackgroundKey && DARK_BACKGROUND_KEYS.has(selectedBackgroundKey)
    ? "#F7F2E8"
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
          runtime.variant.slots.map((slot) =>
            slot.kind === "image"
              ? renderImageSlot(
                  slot,
                  input.manifest,
                  input.fields,
                  input.assetUrlByPath,
                  input.damAssetUrlById,
                  scale,
                  input.assetOrigin
                )
              : renderTextSlot(
                  input.manifest,
                  slot,
                  input.fields,
                  input.textLayoutByField,
                  scale,
                  textColorOverride
                )
          )}
      </div>
    ),
  };
}
