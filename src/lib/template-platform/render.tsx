import React from "react";

import type { TemplateBundleManifest, TemplateBundleTextSlot } from "./manifest";
import { resolveTemplateBundleRuntimeVariant } from "./runtime";

export type TemplateBundleRenderResult = {
  element: React.ReactElement;
  width: number;
  height: number;
};

const INTER_STACK = `"Inter", "ContentGate Sans", ui-sans-serif, system-ui, sans-serif`;
const CONTENTGATE_PUBLIC_ASSET_VERSION = "clean-figwright-2026-07-14-03";

function slotFontWeight(slot: TemplateBundleTextSlot) {
  return slot.fontKey.includes("bold")
    ? 700
    : slot.fontKey.includes("semibold")
      ? 600
      : slot.fontKey.includes("medium")
        ? 500
        : 400;
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function renderTextSlot(slot: TemplateBundleTextSlot, fields: Record<string, unknown>) {
  const text = cleanText(fields[slot.field]);

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
        fontFamily: INTER_STACK,
        fontSize: slot.fontSize,
        fontWeight: slotFontWeight(slot),
        lineHeight: slot.lineHeight,
        letterSpacing: slot.letterSpacing ?? 0,
        textAlign: slot.align ?? "left",
        whiteSpace: "pre-wrap",
        alignItems: "flex-start",
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
          display: "-webkit-box",
          width: "100%",
          minWidth: 0,
          flexShrink: 0,
          maxHeight: "100%",
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

function publicContentGateBundleAssetPath(
  manifest: TemplateBundleManifest,
  assetPath: string
) {
  if (
    manifest.version.name !== "figwright-v1" ||
    !manifest.family.key.startsWith("contentgate-local-")
  ) {
    return null;
  }
  if (assetPath.startsWith("template-packages/contentgate/")) {
    return `/${assetPath}?v=${CONTENTGATE_PUBLIC_ASSET_VERSION}`;
  }
  if (assetPath.startsWith("/template-packages/contentgate/")) {
    return `${assetPath}?v=${CONTENTGATE_PUBLIC_ASSET_VERSION}`;
  }
  return `/template-bundles/${manifest.family.key}/${manifest.version.name}/${assetPath}?v=${CONTENTGATE_PUBLIC_ASSET_VERSION}`;
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
  const runtime = resolveTemplateBundleRuntimeVariant(input.manifest, input.variantKey);
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
            .map((slot) => renderTextSlot(slot, input.fields))}
      </div>
    ),
  };
}
