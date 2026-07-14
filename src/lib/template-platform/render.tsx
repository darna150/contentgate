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
const CONTENTGATE_LOGO_WHITE_SRC = "/brand/contentgate/logo-mono-white.svg";

const CONTENTGATE_LOGO_OVERLAYS: Record<
  string,
  Record<
    string,
    {
      x: number;
      y: number;
      width: number;
      height: number;
      cover: string;
      src?: string;
    }
  >
> = {
  "contentgate-local-friendly": {
    square: { x: 76, y: 59, width: 380, height: 64, cover: "#FBF7EF" },
    story: {
      x: 86,
      y: 106,
      width: 407,
      height: 68,
      cover: "#123C33",
      src: CONTENTGATE_LOGO_WHITE_SRC,
    },
    link_ad: { x: 72, y: 50, width: 276, height: 47, cover: "#FBF7EF" },
    leaderboard: { x: 24, y: 23, width: 216, height: 37, cover: "#FBF7EF" },
    medium_rectangle: { x: 22, y: 24, width: 179, height: 31, cover: "#FBF7EF" },
  },
  "contentgate-local-premium": {
    square: { x: 72, y: 103, width: 398, height: 61, cover: "#FBF7EF" },
    portrait: { x: 76, y: 74, width: 378, height: 58, cover: "#FBF7EF" },
    story: { x: 86, y: 100, width: 425, height: 66, cover: "#FBF7EF" },
    link_ad: { x: 66, y: 79, width: 288, height: 45, cover: "#FBF7EF" },
    medium_rectangle: { x: 22, y: 29, width: 170, height: 27, cover: "#FBF7EF" },
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
                left: logoOverlay.x - 3,
                top: logoOverlay.y - 3,
                width: logoOverlay.width + 6,
                height: logoOverlay.height + 6,
                background: logoOverlay.cover,
                pointerEvents: "none",
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoOverlay.src ?? CONTENTGATE_LOGO_SRC}
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
