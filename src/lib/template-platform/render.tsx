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

function descenderPadding(slot: TemplateBundleTextSlot, fontSize: number) {
  // Figma text boxes can export very tight line-height values (< 1).
  // Browser/Satori rendering can then clip glyph descenders ("g", "y",
  // "p", "q") when the slot clips overflow. Preserve the Figma line
  // height, but use any spare vertical room as a small internal descender
  // buffer so glyph bottoms are not cut off.
  const lineBoxHeight = fontSize * slot.lineHeight * slot.maxLines;
  return Math.max(0, Math.min(fontSize * 0.12, slot.height - lineBoxHeight));
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

function renderTextSlot(
  manifest: TemplateBundleManifest,
  slot: TemplateBundleTextSlot,
  fields: Record<string, unknown>,
  layoutByField?: Record<string, TemplateBundleTextLayout>
) {
  const resolved = layoutByField?.[slot.field];
  const fontSize = resolved?.fontSize ?? slot.fontSize;
  const content = resolved ? resolved.lines.join("\n") : cleanText(fields[slot.field]);
  const horizontalAlign =
    slot.align === "center" ? "center" : slot.align === "right" ? "flex-end" : "flex-start";
  const verticalAlign =
    manifest.family.key.startsWith("contentgate-local-") &&
    slot.kind === "text" &&
    slot.verticalAlign === "top"
      ? "middle"
      : slot.verticalAlign;

  return (
    <div
      key={slot.key}
      data-template-field={slot.field}
      data-template-max-lines={slot.maxLines}
      data-template-font-size={fontSize}
      style={{
        position: "absolute",
        left: slot.x,
        top: slot.y,
        width: slot.width,
        height: slot.height,
        overflow: "hidden",
        color: slot.color,
        display: "flex",
        flexDirection: "column",
        fontFamily: templateBundleFontStack(manifest, slot),
        fontSize,
        fontWeight: templateBundleFontWeight(manifest, slot),
        fontStyle: templateBundleFontStyle(manifest, slot),
        lineHeight: slot.lineHeight,
        letterSpacing: slot.letterSpacing ?? 0,
        textAlign: slot.align ?? "left",
        whiteSpace: "pre-wrap",
        alignItems: horizontalAlign,
        justifyContent:
          verticalAlign === "top"
            ? "flex-start"
            : verticalAlign === "bottom"
              ? "flex-end"
              : "center",
      }}
    >
      <span
        data-template-content
        style={{
          display: "block",
          maxWidth: "100%",
          minWidth: 0,
          flexShrink: 0,
          maxHeight: "100%",
          paddingBottom: descenderPadding(slot, fontSize),
          overflow: "hidden",
          textAlign: slot.align ?? "left",
          whiteSpace: "pre-wrap",
          wordBreak: "normal",
          overflowWrap: "normal",
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
}): TemplateBundleRenderResult | null {
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

  return {
    width: runtime.variant.width,
    height: runtime.variant.height,
    element: (
      <div
        data-template-platform-bundle={input.manifest.family.key}
        style={{
          position: "relative",
          display: "flex",
          width: runtime.variant.width,
          height: runtime.variant.height,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveImageSource(
            input.manifest,
            imagePath,
            input.assetUrlByPath,
            input.assetOrigin
          )}
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
              renderTextSlot(input.manifest, slot, input.fields, input.textLayoutByField)
            )}
      </div>
    ),
  };
}
