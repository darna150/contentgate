import React from "react";

import type { TemplateBundleManifest, TemplateBundleTextSlot } from "./manifest";
import { resolveTemplateBundleRuntimeVariant } from "./runtime";

export type TemplateBundleRenderResult = {
  element: React.ReactElement;
  width: number;
  height: number;
};

const INTER_STACK = `"Inter", "ContentGate Sans", ui-sans-serif, system-ui, sans-serif`;
const CONTENTGATE_LOGO_SRC = "/brand/contentgate/logo-primary-transparent.svg";

const CONTENTGATE_LOGO_OVERLAYS: Record<
  string,
  Record<string, { x: number; y: number; width: number; height: number }>
> = {
  "contentgate-local-friendly": {
    square: { x: 97, y: 84, width: 242, height: 49 },
    story: { x: 97, y: 142, width: 260, height: 52 },
    link_ad: { x: 72, y: 52, width: 220, height: 44 },
    leaderboard: { x: 42, y: 22, width: 178, height: 36 },
    medium_rectangle: { x: 50, y: 29, width: 156, height: 31 },
  },
  "contentgate-local-premium": {
    square: { x: 72, y: 86, width: 242, height: 49 },
    portrait: { x: 81, y: 96, width: 250, height: 50 },
    story: { x: 86, y: 142, width: 260, height: 52 },
    link_ad: { x: 66, y: 54, width: 220, height: 44 },
    medium_rectangle: { x: 22, y: 32, width: 142, height: 28 },
  },
};

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

function resolveImageSource(path: string, assetUrlByPath?: Record<string, string>) {
  const signedUrl = assetUrlByPath?.[path];
  if (signedUrl) return signedUrl;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) {
    return path;
  }
  return `/${path}`;
}

function contentGateLogoOverlay(familyKey: string, variantKey: string) {
  return CONTENTGATE_LOGO_OVERLAYS[familyKey]?.[variantKey] ?? null;
}

export function renderTemplateBundleVariant(input: {
  manifest: TemplateBundleManifest;
  variantKey: string;
  fields: Record<string, unknown>;
  assetUrlByPath?: Record<string, string>;
  original?: boolean;
}): TemplateBundleRenderResult | null {
  const runtime = resolveTemplateBundleRuntimeVariant(input.manifest, input.variantKey);
  if (!runtime) return null;
  const imagePath = input.original
    ? runtime.referenceAssetPath
    : runtime.backgroundAssetPath;
  const logoOverlay = input.original
    ? null
    : contentGateLogoOverlay(input.manifest.family.key, input.variantKey);

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
          src={resolveImageSource(imagePath, input.assetUrlByPath)}
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
        {logoOverlay && (
          <>
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: logoOverlay.x - 6,
                top: logoOverlay.y - 6,
                width: logoOverlay.width + 12,
                height: logoOverlay.height + 12,
                background: "#FBF7EF",
                pointerEvents: "none",
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={CONTENTGATE_LOGO_SRC}
              alt=""
              aria-hidden="true"
              style={{
                position: "absolute",
                left: logoOverlay.x,
                top: logoOverlay.y,
                width: logoOverlay.width,
                height: logoOverlay.height,
                display: "block",
                objectFit: "contain",
                pointerEvents: "none",
              }}
            />
          </>
        )}
        {!input.original &&
          runtime.variant.slots
            .filter((slot): slot is TemplateBundleTextSlot => slot.kind === "text")
            .map((slot) => renderTextSlot(slot, input.fields))}
      </div>
    ),
  };
}
