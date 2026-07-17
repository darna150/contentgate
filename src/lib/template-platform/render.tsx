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

function descenderPadding(slot: TemplateBundleTextSlot) {
  // Figma text boxes can export very tight line-height values (< 1).
  // Browser/Satori rendering can then clip glyph descenders ("g", "y",
  // "p", "q") when the slot clips overflow. Preserve the Figma line
  // height, but use any spare vertical room as a small internal descender
  // buffer so glyph bottoms are not cut off.
  const lineBoxHeight = slot.fontSize * slot.lineHeight * slot.maxLines;
  return Math.max(0, Math.min(slot.fontSize * 0.12, slot.height - lineBoxHeight));
}

function renderTextSlot(
  manifest: TemplateBundleManifest,
  slot: TemplateBundleTextSlot,
  fields: Record<string, unknown>
) {
  const text = cleanText(fields[slot.field]);
  const horizontalAlign =
    slot.align === "center" ? "center" : slot.align === "right" ? "flex-end" : "flex-start";

  return (
    <div
      key={slot.key}
      data-template-field={slot.field}
      data-template-max-lines={slot.maxLines}
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
        fontSize: slot.fontSize,
        fontWeight: templateBundleFontWeight(manifest, slot),
        fontStyle: templateBundleFontStyle(manifest, slot),
        lineHeight: slot.lineHeight,
        letterSpacing: slot.letterSpacing ?? 0,
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
          display: "block",
          maxWidth: "100%",
          minWidth: 0,
          flexShrink: 0,
          maxHeight: "100%",
          paddingBottom: descenderPadding(slot),
          overflow: "hidden",
          textAlign: slot.align ?? "left",
          whiteSpace: "pre-wrap",
          wordBreak: "normal",
          overflowWrap: "normal",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: slot.maxLines,
        }}
      >
        {text}
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
            .map((slot) => renderTextSlot(input.manifest, slot, input.fields))}
      </div>
    ),
  };
}
