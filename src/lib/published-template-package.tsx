import React from "react";

import type { FieldLimits } from "./template-fields";
import {
  TEMPLATE_OUTPUT_SIZES,
  type TemplateSizeKey,
} from "./template-contract";
import type { TemplateRenderInput } from "./template-renderer";

type RenderResult = {
  element: React.ReactElement;
  w: number;
  h: number;
};

export type PublishedTextSlot = {
  field: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  lineHeight: number;
  weight: number;
  color: string;
  maxChars: number;
  maxLines: number;
  lineChars?: number;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "center" | "bottom";
  family?: string;
  fallback?: string;
  background?: string;
  radius?: number;
};

type ImageSlot = {
  field: string;
  x: number;
  y: number;
  w: number;
  h: number;
  radius?: number;
  fallbackColor: string;
  objectFit?: "cover" | "contain";
};

type Layer =
  | {
      kind: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      radius?: number;
      borderColor?: string;
      borderWidth?: number;
      shadow?: string;
      opacity?: number;
    }
  | {
      kind: "rule";
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      radius?: number;
    }
  | {
      kind: "brand";
      x: number;
      y: number;
      scale: number;
      light?: boolean;
    }
  | {
      kind: "dashboard";
      x: number;
      y: number;
      w: number;
      h: number;
      compact?: boolean;
      dark?: boolean;
    };

type PublishedFrame = {
  size: TemplateSizeKey;
  background: string;
  referenceImage?: string;
  generatedImage?: string;
  layers: Layer[];
  textSlots: PublishedTextSlot[];
  imageSlots?: ImageSlot[];
};

export type PublishedTemplatePackage = {
  packageVersion: 1;
  packageKey: string;
  publicName: string;
  frames: Partial<Record<TemplateSizeKey, PublishedFrame>>;
};

type PackageDefinition = {
  published_package?: PublishedTemplatePackage;
};

const GREEN = "#12312B";
const TEAL = "#0E5F58";
const MINT = "#DDEDE5";
const WARM = "#F7F2E8";
const RUST = "#B85D40";
const WHITE = "#FFFFFF";
const LINE = "#DCE5DE";
const INTER_STACK = '"Inter", "ContentGate Sans", ui-sans-serif, system-ui, sans-serif';

export function normalizePublishedTemplateText(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function cleanText(value: unknown) {
  return normalizePublishedTemplateText(value);
}

function resolvePublishedFrame(
  layoutKey: string,
  sizeKey: TemplateSizeKey,
  definition?: unknown
) {
  const resolved = resolvePublishedTemplatePackage(layoutKey, definition);
  const fallback = PACKAGE_REGISTRY[layoutKey] ?? null;
  const pkg = resolved?.frames[sizeKey] ? resolved : fallback;
  return { pkg, frameSpec: pkg?.frames[sizeKey] ?? null };
}

export function getPublishedTemplateFrameFieldLimits(
  layoutKey: string,
  sizeKey: TemplateSizeKey,
  definition?: unknown
): FieldLimits | null {
  const { frameSpec } = resolvePublishedFrame(layoutKey, sizeKey, definition);
  if (!frameSpec) return null;
  return Object.fromEntries(
    frameSpec.textSlots.map((slot) => [
      slot.field,
      {
        max_chars: slot.maxChars,
        max_lines: slot.maxLines,
      },
    ])
  );
}

export function getPublishedTemplateFrameTextSlots(
  layoutKey: string,
  sizeKey: TemplateSizeKey,
  definition?: unknown
): PublishedTextSlot[] | null {
  const { frameSpec } = resolvePublishedFrame(layoutKey, sizeKey, definition);
  return frameSpec?.textSlots ?? null;
}

function overlapArea(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

export function auditPublishedTemplateFrameVisuals(
  layoutKey: string,
  sizeKey: TemplateSizeKey,
  definition?: unknown
): string[] {
  const { frameSpec } = resolvePublishedFrame(layoutKey, sizeKey, definition);
  if (!frameSpec || frameSpec.layers.length === 0) return [];

  const issues: string[] = [];
  const rectLayers = frameSpec.layers.filter((layer) => layer.kind === "rect");
  for (const slot of frameSpec.textSlots) {
    if (slot.color.toUpperCase() !== WHITE) continue;
    if (slot.background) continue;

    const slotArea = slot.w * slot.h;
    const hasBackingRect = rectLayers.some((layer) => {
      const area = overlapArea(slot, layer);
      return area / slotArea >= 0.85 && layer.color.toUpperCase() !== WHITE;
    });

    if (!hasBackingRect) {
      issues.push(
        `${layoutKey}/${sizeKey}/${slot.field} has white text without a locked backing shape`
      );
    }
  }

  return issues;
}

export function publishedTemplateFrameUsesVectorLayers(
  layoutKey: string,
  sizeKey: TemplateSizeKey,
  definition?: unknown
) {
  const { frameSpec } = resolvePublishedFrame(layoutKey, sizeKey, definition);
  return Boolean(frameSpec?.layers.length);
}

function BrandMark({
  scale,
  light = false,
}: {
  scale: number;
  light?: boolean;
}) {
  const fg = light ? WHITE : GREEN;
  const bg = light ? "rgba(255,255,255,.16)" : MINT;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13 * scale }}>
      <div
        style={{
          display: "flex",
          position: "relative",
          width: 42 * scale,
          height: 42 * scale,
          borderRadius: 9 * scale,
          background: bg,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 9 * scale,
            top: 7 * scale,
            width: 24 * scale,
            height: 30 * scale,
            borderRadius: 5 * scale,
            background: fg,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 15 * scale,
            top: 15 * scale,
            width: 12 * scale,
            height: 22 * scale,
            background: light ? GREEN : bg,
          }}
        />
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            style={{
              position: "absolute",
              left: 17 * scale,
              top: (20 + index * 6) * scale,
              width: (10 - index * 2) * scale,
              height: 3 * scale,
              borderRadius: 99,
              background: light ? MINT : TEAL,
            }}
          />
        ))}
      </div>
      <div
        style={{
          color: fg,
          fontFamily: "ContentGate Sans",
          fontSize: 25 * scale,
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        ContentGate
      </div>
    </div>
  );
}

function DashboardMockup({
  w,
  h,
  compact = false,
  dark = false,
}: {
  w: number;
  h: number;
  compact?: boolean;
  dark?: boolean;
}) {
  const side = compact ? Math.max(22, w * 0.25) : w * 0.22;
  const pad = compact ? 12 : 30;
  const cards = compact ? 2 : 3;
  const cardGap = compact ? 10 : 18;
  const cardW = (w - side - pad * 2 - cardGap * (cards - 1)) / cards;
  const cardH = compact ? h * 0.42 : Math.min(148, h * 0.27);

  return (
    <div
      style={{
        display: "flex",
        width: w,
        height: h,
        overflow: "hidden",
        borderRadius: compact ? 14 : 24,
        border: `2px solid ${dark ? "rgba(255,255,255,.2)" : LINE}`,
        background: dark ? "#163D35" : WHITE,
        boxShadow: compact
          ? "0 18px 44px rgba(18,49,43,.14)"
          : "0 30px 70px rgba(18,49,43,.16)",
      }}
    >
      <div style={{ display: "flex", width: side, height: "100%", background: dark ? "#071F1A" : GREEN }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: compact ? "center" : "space-between",
          gap: compact ? 8 : 18,
          width: w - side,
          padding: pad,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "46%", height: compact ? 8 : 14, borderRadius: 99, background: dark ? MINT : GREEN }} />
          <div style={{ width: "18%", height: compact ? 16 : 28, borderRadius: 99, background: dark ? "rgba(255,255,255,.18)" : MINT }} />
        </div>
        <div style={{ display: "flex", gap: cardGap }}>
          {Array.from({ length: cards }).map((_, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                gap: compact ? 5 : 8,
                width: cardW,
                height: cardH,
                padding: compact ? 8 : 16,
                borderRadius: compact ? 10 : 18,
                background: index === 0 ? "#F1C9B9" : index === 1 ? "#BFE9D7" : "#E6DFD0",
                boxSizing: "border-box",
              }}
            >
              <div style={{ width: "68%", height: compact ? 5 : 8, borderRadius: 99, background: GREEN }} />
              <div style={{ width: "48%", height: compact ? 4 : 6, borderRadius: 99, background: "#7E9088" }} />
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            height: compact ? 22 : 44,
            padding: compact ? "0 10px" : "0 18px",
            borderRadius: 999,
            background: dark ? "rgba(255,255,255,.14)" : WARM,
          }}
        >
          <div style={{ width: compact ? 8 : 14, height: compact ? 8 : 14, borderRadius: 99, background: RUST }} />
          <div style={{ width: "54%", height: compact ? 5 : 8, borderRadius: 99, background: dark ? MINT : TEAL }} />
        </div>
      </div>
    </div>
  );
}

function renderLayer(layer: Layer, index: number) {
  const base = {
    display: "flex" as const,
    position: "absolute" as const,
    left: layer.x,
    top: layer.y,
  };

  if (layer.kind === "brand") {
    return (
      <div key={index} style={base}>
        <BrandMark scale={layer.scale} light={layer.light} />
      </div>
    );
  }

  if (layer.kind === "dashboard") {
    return (
      <div key={index} style={base}>
        <DashboardMockup
          w={layer.w}
          h={layer.h}
          compact={layer.compact}
          dark={layer.dark}
        />
      </div>
    );
  }

  if (layer.kind === "rule") {
    return (
      <div
        key={index}
        style={{
          ...base,
          width: layer.w,
          height: layer.h,
          borderRadius: layer.radius ?? 999,
          background: layer.color,
        }}
      />
    );
  }

  return (
    <div
      key={index}
      style={{
        ...base,
        width: layer.w,
        height: layer.h,
        borderRadius: layer.radius ?? 0,
        background: layer.color,
        ...(layer.borderColor
          ? { border: `${layer.borderWidth ?? 1}px solid ${layer.borderColor}` }
          : {}),
        ...(layer.shadow ? { boxShadow: layer.shadow } : {}),
        ...(layer.opacity == null ? {} : { opacity: layer.opacity }),
      }}
    />
  );
}

function renderTextSlot(slot: PublishedTextSlot, fields: Record<string, string>) {
  const family = slot.family ? `"${slot.family}", ${INTER_STACK}` : INTER_STACK;
  const text = cleanText(fields[slot.field] || slot.fallback);

  return (
    <div
      key={slot.field}
      data-template-field={slot.field}
      data-template-max-lines={slot.maxLines}
      style={{
        position: "absolute",
        left: slot.x,
        top: slot.y,
        width: slot.w,
        height: slot.h,
        overflow: "hidden",
        color: slot.color,
        display: "flex",
        flexDirection: "column",
        fontFamily: family,
        fontSize: slot.fontSize,
        fontWeight: slot.weight,
        lineHeight: slot.lineHeight,
        textAlign: slot.align ?? "left",
        whiteSpace: "pre-wrap",
        ...(slot.background ? { background: slot.background } : {}),
        ...(slot.radius == null ? {} : { borderRadius: slot.radius }),
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
          overflow: "hidden",
        }}
      >
        {text}
      </span>
    </div>
  );
}

function renderImageSlot(slot: ImageSlot, fields: Record<string, string>) {
  const src = cleanText(fields[slot.field]);
  return (
    <div
      key={slot.field}
      data-template-field={slot.field}
      style={{
        position: "absolute",
        left: slot.x,
        top: slot.y,
        width: slot.w,
        height: slot.h,
        overflow: "hidden",
        borderRadius: slot.radius ?? 0,
        background: slot.fallbackColor,
        display: "flex",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-template-content
          src={src}
          alt=""
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: slot.objectFit ?? "cover",
          }}
        />
      ) : (
        <span data-template-content style={{ display: "block", width: "100%", height: "100%" }} />
      )}
    </div>
  );
}

function frame(
  size: TemplateSizeKey,
  background: string,
  layers: Layer[],
  textSlots: PublishedTextSlot[],
  imageSlots: ImageSlot[] = [],
  options: Pick<PublishedFrame, "referenceImage" | "generatedImage"> = {}
): PublishedFrame {
  return { size, background, layers, textSlots, imageSlots, ...options };
}

function aerformTextSlots(size: TemplateSizeKey): PublishedTextSlot[] {
  const dims = TEMPLATE_OUTPUT_SIZES[size];
  const lightInk = "#0A0A0A";
  const muted = "#4B4842";
  const print = size === "us_letter" || size === "poster" || size === "rack_card";
  const compact = size === "leaderboard" || size === "medium_rectangle";

  const headline =
    size === "leaderboard"
      ? { x: 178, y: 18, w: 250, h: 26, fontSize: 19, maxChars: 34, maxLines: 1 }
      : size === "medium_rectangle"
        ? { x: 24, y: 62, w: 154, h: 58, fontSize: 25, maxChars: 38, maxLines: 2 }
        : size === "link_ad"
          ? { x: 648, y: 110, w: 410, h: 92, fontSize: 38, maxChars: 56, maxLines: 2 }
          : print
            ? {
                x: dims.w * 0.08,
                y: dims.h * 0.13,
                w: dims.w * 0.42,
                h: dims.h * 0.18,
                fontSize: size === "rack_card" ? 30 : size === "poster" ? 56 : 48,
                maxChars: 64,
                maxLines: 3,
              }
            : {
                x: dims.w * 0.08,
                y: dims.h * 0.17,
                w: dims.w * 0.55,
                h: dims.h * 0.16,
                fontSize: size === "story" ? 82 : size === "portrait" ? 74 : 70,
                maxChars: 56,
                maxLines: 2,
              };

  const subheadline =
    size === "leaderboard"
      ? { x: 178, y: 46, w: 300, h: 16, fontSize: 9, maxChars: 78, maxLines: 1 }
      : size === "medium_rectangle"
        ? { x: 24, y: 128, w: 156, h: 34, fontSize: 10, maxChars: 64, maxLines: 2 }
        : size === "link_ad"
          ? { x: 648, y: 228, w: 360, h: 46, fontSize: 16, maxChars: 100, maxLines: 2 }
          : print
            ? {
                x: dims.w * 0.08,
                y: dims.h * 0.34,
                w: dims.w * 0.36,
                h: dims.h * 0.06,
                fontSize: size === "rack_card" ? 11 : size === "poster" ? 18 : 16,
                maxChars: 110,
                maxLines: 2,
              }
            : {
                x: dims.w * 0.08,
                y: dims.h * (size === "story" ? 0.33 : 0.39),
                w: dims.w * 0.44,
                h: dims.h * 0.07,
                fontSize: size === "story" ? 31 : size === "portrait" ? 27 : 25,
                maxChars: 96,
                maxLines: 2,
              };

  const cta =
    size === "leaderboard"
      ? { x: 504, y: 28, w: 96, h: 20, fontSize: 11, maxChars: 18, maxLines: 1 }
      : size === "medium_rectangle"
        ? { x: 24, y: 194, w: 86, h: 20, fontSize: 10, maxChars: 18, maxLines: 1 }
        : print
          ? {
              x: dims.w * 0.65,
              y: dims.h * 0.82,
              w: dims.w * 0.22,
              h: dims.h * 0.03,
              fontSize: size === "rack_card" ? 9 : 14,
              maxChars: 24,
              maxLines: 1,
            }
          : {
              x: dims.w * 0.08,
              y: dims.h * (size === "story" ? 0.54 : 0.72),
              w: dims.w * 0.18,
              h: dims.h * 0.035,
              fontSize: compact ? 10 : 18,
              maxChars: 24,
              maxLines: 1,
            };

  const slots: PublishedTextSlot[] = [
    {
      field: "headline",
      ...headline,
      lineHeight: size === "leaderboard" ? 1.05 : 0.94,
      weight: 400,
      color: lightInk,
      lineChars: size === "leaderboard" ? 34 : 20,
      family: "Inter",
      fallback: print ? "Built for lighter movement." : "Carry lighter. Move quieter.",
    },
    {
      field: "subheadline",
      ...subheadline,
      lineHeight: 1.18,
      weight: 400,
      color: muted,
      lineChars: size === "leaderboard" ? 48 : 34,
      family: "Inter",
      fallback: "Technical carry for commute, studio, and travel.",
    },
    {
      field: "cta",
      ...cta,
      lineHeight: 1.05,
      weight: 600,
      color: lightInk,
      family: "Inter",
      fallback: print ? "Explore Air 01" : "Explore",
    },
  ];

  if (print) {
    slots.push({
      field: "product_specs",
      x: dims.w * 0.08,
      y: dims.h * 0.48,
      w: dims.w * 0.45,
      h: dims.h * 0.2,
      fontSize: size === "rack_card" ? 6.5 : size === "poster" ? 12 : 10.5,
      lineHeight: 1.28,
      weight: 500,
      color: lightInk,
      maxChars: size === "rack_card" ? 150 : 240,
      maxLines: size === "rack_card" ? 7 : 8,
      lineChars: size === "rack_card" ? 28 : 42,
      family: "Inter",
      fallback:
        "PRODUCT SPECIFICATIONS\nCapacity 24L daily / 32L expanded\nLaptop fit Fits up to 16-inch laptop\nAccess Quick side pocket\nMaterials Recycled nylon shell",
    });
    slots.push({
      field: "proof_note",
      x: dims.w * 0.12,
      y: dims.h * 0.79,
      w: dims.w * 0.46,
      h: dims.h * 0.04,
      fontSize: size === "rack_card" ? 7 : 12,
      lineHeight: 1.15,
      weight: 400,
      color: muted,
      maxChars: 120,
      maxLines: 2,
      lineChars: 56,
      family: "Inter",
      fallback: "Recycled technical fabric with structured support and weather-ready finishing.",
    });
  }

  return slots;
}

function aerformFrame(
  size: TemplateSizeKey,
  fileName: string,
  set: "set-b"
): PublishedFrame {
  return frame(
    size,
    "#F5F5F7",
    [],
    aerformTextSlots(size),
    [],
    {
      referenceImage: `/template-packages/contentgate/${set}/${fileName}.png`,
      generatedImage: `/template-packages/contentgate/${set}/backgrounds/${fileName}.png`,
    }
  );
}

function aerformPackage(set: "set-b"): PublishedTemplatePackage {
  return {
    packageVersion: 1,
    packageKey: `aerform-air01-campaign-${set}-v1`,
    publicName: "Aerform Air 01 Campaign System",
    frames: {
      portrait: aerformFrame("portrait", "portrait", set),
      square: aerformFrame("square", "square", set),
      story: aerformFrame("story", "story", set),
      linkedin_square: aerformFrame("linkedin_square", "linkedin-square", set),
      link_ad: aerformFrame("link_ad", "link-ad", set),
      leaderboard: aerformFrame("leaderboard", "leaderboard", set),
      medium_rectangle: aerformFrame("medium_rectangle", "medium-rectangle", set),
      us_letter: aerformFrame("us_letter", "us-letter", set),
      poster: aerformFrame("poster", "poster", set),
      rack_card: aerformFrame("rack_card", "rack-card", set),
    },
  };
}

const PACKAGE_REGISTRY: Record<string, PublishedTemplatePackage> = {
  contentgate_local_premium: aerformPackage("set-b"),
};

function isPackage(value: unknown): value is PublishedTemplatePackage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as PublishedTemplatePackage;
  return (
    candidate.packageVersion === 1 &&
    Boolean(candidate.frames) &&
    Object.keys(candidate.frames).length > 0
  );
}

export function resolvePublishedTemplatePackage(
  layoutKey: string,
  definition?: unknown
): PublishedTemplatePackage | null {
  const candidate = (definition as PackageDefinition | undefined)?.published_package;
  if (isPackage(candidate)) return candidate;
  return PACKAGE_REGISTRY[layoutKey] ?? null;
}

export function stripInternalTemplateDefinition(
  definition: Record<string, unknown>
): Record<string, unknown> {
  const {
    design_source,
    figma_url,
    internal_notes,
    service_model,
    ...clientSafe
  } = definition;
  void design_source;
  void figma_url;
  void internal_notes;
  void service_model;
  return clientSafe;
}

export function renderPublishedTemplatePackage(
  input: TemplateRenderInput
): RenderResult | null {
  const { pkg, frameSpec } = resolvePublishedFrame(
    input.layoutKey,
    input.sizeKey,
    input.definition
  );
  if (!pkg || !frameSpec) return null;
  const dimensions = TEMPLATE_OUTPUT_SIZES[input.sizeKey];
  const renderedImage = input.original
    ? frameSpec.referenceImage
    : frameSpec.layers.length === 0
      ? frameSpec.generatedImage
      : undefined;

  return {
    w: dimensions.w,
    h: dimensions.h,
    element: (
      <div
        data-template-package={pkg.packageKey}
        style={{
          display: "flex",
          position: "relative",
          width: dimensions.w,
          height: dimensions.h,
          overflow: "hidden",
          background: frameSpec.background,
        }}
      >
        {renderedImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${input.origin}${renderedImage}`}
            alt=""
            style={{
              display: "block",
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            }}
          />
        ) : (
          frameSpec.layers.map(renderLayer)
        )}
        {!input.original && (
          <>
            {frameSpec.imageSlots?.map((slot) => renderImageSlot(slot, input.fields))}
            {frameSpec.textSlots.map((slot) => renderTextSlot(slot, input.fields))}
          </>
        )}
      </div>
    ),
  };
}
