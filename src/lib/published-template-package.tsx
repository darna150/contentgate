import React from "react";

import { fitCopy } from "./render-copy";
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

type TextSlot = {
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
  layers: Layer[];
  textSlots: TextSlot[];
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
const FOREST = "#0B2A24";
const TEAL = "#0E5F58";
const MINT = "#DDEDE5";
const WARM = "#F7F2E8";
const RUST = "#B85D40";
const INK = "#172521";
const MUTED = "#52615B";
const WHITE = "#FFFFFF";
const LINE = "#DCE5DE";

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function fitText(value: unknown, slot: TextSlot) {
  const text = cleanText(value || slot.fallback);
  const wrapped = fitCopy(text, {
    maxLines: slot.maxLines,
    lineChars: slot.lineChars,
  });
  if (wrapped.length <= slot.maxChars) return wrapped;

  const clipped = wrapped.slice(0, slot.maxChars).trimEnd();
  const boundary = clipped.lastIndexOf(" ");
  return boundary > slot.maxChars * 0.55 ? clipped.slice(0, boundary) : clipped;
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

function renderTextSlot(slot: TextSlot, fields: Record<string, string>) {
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
        color: slot.color,
        display: "flex",
        flexDirection: "column",
        fontFamily: slot.family ?? "ContentGate Sans",
        fontSize: slot.fontSize,
        fontWeight: slot.weight,
        lineHeight: slot.lineHeight,
        textAlign: slot.align ?? "left",
        whiteSpace: "pre-wrap",
        ...(slot.background ? { background: slot.background } : {}),
        ...(slot.radius == null ? {} : { borderRadius: slot.radius }),
        ...(slot.background
          ? { alignItems: "center", justifyContent: "center" }
          : { alignItems: "flex-start", justifyContent: "flex-start" }),
      }}
    >
      <span
        data-template-content
        style={{
          display: "flex",
          width: "100%",
          ...(slot.background ? { height: "100%", alignItems: "center" } : {}),
          justifyContent:
            slot.align === "center"
              ? "center"
              : slot.align === "right"
                ? "flex-end"
                : "flex-start",
          textAlign: slot.align ?? "left",
        }}
      >
        {fitText(fields[slot.field], slot)}
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
  textSlots: TextSlot[],
  imageSlots: ImageSlot[] = []
): PublishedFrame {
  return { size, background, layers, textSlots, imageSlots };
}

function friendlyPackage(): PublishedTemplatePackage {
  return {
    packageVersion: 1,
    packageKey: "contentgate-localized-ads-set-a-v1",
    publicName: "Set A - Local Content Friendly",
    frames: {
      square: frame(
        "square",
        WHITE,
        [
          { kind: "rect", x: 0, y: 0, w: 1080, h: 1080, color: WHITE },
          { kind: "rect", x: 660, y: 110, w: 300, h: 850, color: WARM, radius: 28 },
          { kind: "brand", x: 72, y: 70, scale: 1.25 },
          { kind: "dashboard", x: 560, y: 250, w: 430, h: 330 },
          { kind: "rule", x: 72, y: 455, w: 116, h: 12, color: RUST },
        ],
        [
          { field: "headline", x: 72, y: 500, w: 520, h: 210, fontSize: 68, lineHeight: 0.98, weight: 850, color: INK, maxChars: 58, maxLines: 3, lineChars: 18, fallback: "Local content, made on brand." },
          { field: "subheadline", x: 72, y: 735, w: 560, h: 118, fontSize: 28, lineHeight: 1.22, weight: 400, color: MUTED, maxChars: 130, maxLines: 4, lineChars: 34 },
          { field: "local_detail", x: 72, y: 875, w: 560, h: 60, fontSize: 23, lineHeight: 1.15, weight: 800, color: TEAL, maxChars: 74, maxLines: 2, lineChars: 40 },
          { field: "cta", x: 72, y: 964, w: 285, h: 58, fontSize: 22, lineHeight: 1, weight: 800, color: WHITE, maxChars: 28, maxLines: 1, align: "center", background: GREEN, radius: 999 },
        ],
        []
      ),
      story: frame(
        "story",
        WHITE,
        [
          { kind: "rect", x: 0, y: 0, w: 1080, h: 1030, color: WARM },
          { kind: "brand", x: 86, y: 72, scale: 1.5 },
          { kind: "dashboard", x: 86, y: 210, w: 908, h: 730 },
          { kind: "rule", x: 86, y: 1015, w: 112, h: 12, color: RUST },
        ],
        [
          { field: "headline", x: 86, y: 1070, w: 890, h: 180, fontSize: 74, lineHeight: 0.98, weight: 850, color: INK, maxChars: 58, maxLines: 3, lineChars: 22 },
          { field: "subheadline", x: 86, y: 1298, w: 760, h: 145, fontSize: 33, lineHeight: 1.22, weight: 400, color: MUTED, maxChars: 130, maxLines: 4, lineChars: 35 },
          { field: "local_detail", x: 86, y: 1488, w: 820, h: 72, fontSize: 27, lineHeight: 1.16, weight: 800, color: TEAL, maxChars: 74, maxLines: 2, lineChars: 42 },
          { field: "cta", x: 86, y: 1608, w: 520, h: 96, fontSize: 31, lineHeight: 1, weight: 800, color: WHITE, maxChars: 28, maxLines: 1, align: "center", background: GREEN, radius: 999 },
          { field: "proof_note", x: 86, y: 1735, w: 600, h: 78, fontSize: 25, lineHeight: 1.12, weight: 800, color: TEAL, maxChars: 64, maxLines: 2, lineChars: 32 },
        ]
      ),
      link_ad: frame(
        "link_ad",
        WHITE,
        [
          { kind: "rect", x: 0, y: 0, w: 1200, h: 628, color: WHITE },
          { kind: "rect", x: 760, y: 54, w: 330, h: 520, color: WARM, radius: 28 },
          { kind: "brand", x: 66, y: 58, scale: 1.05 },
          { kind: "dashboard", x: 650, y: 150, w: 470, h: 330 },
          { kind: "rule", x: 66, y: 242, w: 104, h: 10, color: RUST },
        ],
        [
          { field: "headline", x: 66, y: 276, w: 550, h: 142, fontSize: 58, lineHeight: 0.98, weight: 850, color: INK, maxChars: 58, maxLines: 3, lineChars: 19 },
          { field: "subheadline", x: 66, y: 438, w: 560, h: 70, fontSize: 22, lineHeight: 1.2, weight: 400, color: MUTED, maxChars: 112, maxLines: 3, lineChars: 44 },
          { field: "cta", x: 66, y: 535, w: 255, h: 54, fontSize: 20, lineHeight: 1, weight: 800, color: WHITE, maxChars: 28, maxLines: 1, align: "center", background: GREEN, radius: 999 },
        ]
      ),
      leaderboard: frame(
        "leaderboard",
        WHITE,
        [
          { kind: "brand", x: 18, y: 27, scale: 0.72 },
          { kind: "rule", x: 190, y: 18, w: 5, h: 54, color: RUST },
        ],
        [
          { field: "headline", x: 214, y: 10, w: 250, h: 30, fontSize: 20, lineHeight: 1, weight: 850, color: INK, maxChars: 42, maxLines: 1 },
          { field: "subheadline", x: 214, y: 44, w: 330, h: 32, fontSize: 11.5, lineHeight: 1.15, weight: 400, color: MUTED, maxChars: 78, maxLines: 2, lineChars: 42 },
          { field: "cta", x: 578, y: 25, w: 132, h: 40, fontSize: 13, lineHeight: 1, weight: 800, color: WHITE, maxChars: 18, maxLines: 1, align: "center", background: GREEN, radius: 999 },
        ]
      ),
      medium_rectangle: frame(
        "medium_rectangle",
        WHITE,
        [
          { kind: "rule", x: 22, y: 18, w: 44, h: 4, color: RUST },
          { kind: "brand", x: 22, y: 31, scale: 0.62 },
          { kind: "dashboard", x: 204, y: 72, w: 70, h: 48, compact: true },
        ],
        [
          { field: "headline", x: 22, y: 90, w: 180, h: 72, fontSize: 24, lineHeight: 0.98, weight: 850, color: INK, maxChars: 46, maxLines: 3, lineChars: 20 },
          { field: "subheadline", x: 22, y: 170, w: 170, h: 31, fontSize: 11.5, lineHeight: 1.18, weight: 400, color: MUTED, maxChars: 52, maxLines: 2, lineChars: 26 },
          { field: "cta", x: 22, y: 203, w: 132, h: 30, fontSize: 12, lineHeight: 1, weight: 800, color: WHITE, maxChars: 18, maxLines: 1, align: "center", background: GREEN, radius: 999 },
        ]
      ),
    },
  };
}

function premiumPackage(): PublishedTemplatePackage {
  const pkg = friendlyPackage();
  return {
    ...pkg,
    packageKey: "contentgate-localized-ads-set-b-v1",
    publicName: "Set B - Local Content Premium",
    frames: {
      ...pkg.frames,
      square: frame(
        "square",
        FOREST,
        [
          { kind: "rect", x: 0, y: 0, w: 1080, h: 1080, color: FOREST },
          { kind: "rect", x: 62, y: 62, w: 956, h: 956, color: WARM, radius: 34 },
          { kind: "brand", x: 100, y: 102, scale: 1.18 },
          { kind: "dashboard", x: 550, y: 220, w: 390, h: 310, dark: true },
          { kind: "rule", x: 100, y: 430, w: 116, h: 12, color: RUST },
        ],
        [
          { field: "headline", x: 100, y: 480, w: 540, h: 210, fontSize: 64, lineHeight: 0.98, weight: 850, color: INK, maxChars: 64, maxLines: 3, lineChars: 19 },
          { field: "subheadline", x: 100, y: 725, w: 580, h: 118, fontSize: 27, lineHeight: 1.22, weight: 400, color: MUTED, maxChars: 132, maxLines: 4, lineChars: 36 },
          { field: "local_detail", x: 100, y: 870, w: 590, h: 58, fontSize: 23, lineHeight: 1.15, weight: 800, color: TEAL, maxChars: 74, maxLines: 2, lineChars: 38 },
          { field: "cta", x: 100, y: 956, w: 330, h: 58, fontSize: 21, lineHeight: 1, weight: 800, color: WHITE, maxChars: 30, maxLines: 1, align: "center", background: GREEN, radius: 999 },
        ]
      ),
      portrait: frame(
        "portrait",
        FOREST,
        [
          { kind: "rect", x: 0, y: 0, w: 1080, h: 1350, color: FOREST },
          { kind: "brand", x: 82, y: 80, scale: 1.3, light: true },
          { kind: "dashboard", x: 82, y: 210, w: 916, h: 500, dark: true },
          { kind: "rule", x: 82, y: 780, w: 112, h: 12, color: RUST },
        ],
        [
          { field: "headline", x: 82, y: 835, w: 850, h: 165, fontSize: 64, lineHeight: 0.98, weight: 850, color: WHITE, maxChars: 64, maxLines: 3, lineChars: 24 },
          { field: "subheadline", x: 82, y: 1040, w: 760, h: 96, fontSize: 27, lineHeight: 1.2, weight: 400, color: "#D9E7DF", maxChars: 132, maxLines: 4, lineChars: 38 },
          { field: "local_detail", x: 82, y: 1170, w: 760, h: 55, fontSize: 23, lineHeight: 1.15, weight: 800, color: MINT, maxChars: 74, maxLines: 2, lineChars: 42 },
          { field: "cta", x: 82, y: 1260, w: 390, h: 64, fontSize: 22, lineHeight: 1, weight: 800, color: GREEN, maxChars: 30, maxLines: 1, align: "center", background: MINT, radius: 999 },
        ]
      ),
    },
  };
}

const PACKAGE_REGISTRY: Record<string, PublishedTemplatePackage> = {
  contentgate_local_friendly: friendlyPackage(),
  contentgate_local_premium: premiumPackage(),
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
  const resolved = resolvePublishedTemplatePackage(input.layoutKey, input.definition);
  const fallback = PACKAGE_REGISTRY[input.layoutKey] ?? null;
  const pkg = resolved?.frames[input.sizeKey] ? resolved : fallback;
  const frameSpec = pkg?.frames[input.sizeKey];
  if (!pkg || !frameSpec) return null;
  const dimensions = TEMPLATE_OUTPUT_SIZES[input.sizeKey];

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
        {frameSpec.layers.map(renderLayer)}
        {frameSpec.imageSlots?.map((slot) => renderImageSlot(slot, input.fields))}
        {frameSpec.textSlots.map((slot) => renderTextSlot(slot, input.fields))}
      </div>
    ),
  };
}
