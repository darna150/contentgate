import React from "react";

import { renderPublishedTemplatePackage } from "../published-template-package";
import type { TemplateSizeKey } from "../template-contract";
import type { TemplateBundleManifest, TemplateBundleTextSlot } from "./manifest";
import { resolveTemplateBundleRuntimeVariant } from "./runtime";

export type TemplateBundleRenderResult = {
  element: React.ReactElement;
  width: number;
  height: number;
};

const INTER_STACK = `"Inter", "ContentGate Sans", ui-sans-serif, system-ui, sans-serif`;

const CONTENTGATE_PLATFORM_LAYOUTS: Record<string, string> = {
  "contentgate-local-friendly": "contentgate_local_friendly",
  "contentgate-local-premium": "contentgate_local_premium",
};

function contentGateLayoutKey(manifest: TemplateBundleManifest) {
  return CONTENTGATE_PLATFORM_LAYOUTS[manifest.family.key] ?? null;
}

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
        overflow: "visible",
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
          display: "block",
          width: "100%",
          minWidth: 0,
          flexShrink: 0,
          textAlign: slot.align ?? "left",
          whiteSpace: "pre-wrap",
          wordBreak: "normal",
        }}
      >
        {text}
      </span>
    </div>
  );
}

export function renderTemplateBundleVariant(input: {
  manifest: TemplateBundleManifest;
  variantKey: string;
  fields: Record<string, unknown>;
  original?: boolean;
  origin?: string;
}): TemplateBundleRenderResult | null {
  const contentGateLayout = contentGateLayoutKey(input.manifest);
  if (contentGateLayout) {
    const rendered = renderPublishedTemplatePackage({
      layoutKey: contentGateLayout,
      sizeKey: input.variantKey as TemplateSizeKey,
      fields: Object.fromEntries(
        Object.entries(input.fields).map(([key, value]) => [key, String(value ?? "")])
      ),
      disclaimer: "",
      origin: input.origin ?? "",
      original: input.original,
      definition: {},
    });
    return rendered
      ? { element: rendered.element, width: rendered.w, height: rendered.h }
      : null;
  }

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
          src={`${input.origin ?? ""}/${imagePath}`}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
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
