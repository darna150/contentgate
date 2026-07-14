import React from "react";

import { fitCopy } from "./render-copy";
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
const FIGMA_WARM_A = "#F8F5EE";
const RUST = "#B85D40";
const MUTED = "#52615B";
const WHITE = "#FFFFFF";
const LINE = "#DCE5DE";
const INTER_STACK = '"Inter", "ContentGate Sans", ui-sans-serif, system-ui, sans-serif';

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
  const family = slot.family ? `"${slot.family}", ${INTER_STACK}` : INTER_STACK;

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
          display: "flex",
          width: "100%",
          height: "100%",
          maxWidth: "100%",
          maxHeight: "100%",
          overflow: "hidden",
          alignItems:
            slot.verticalAlign === "top"
              ? "flex-start"
              : slot.verticalAlign === "bottom"
                ? "flex-end"
                : "center",
          justifyContent:
            slot.align === "center"
              ? "center"
              : slot.align === "right"
                ? "flex-end"
                : "flex-start",
          textAlign: slot.align ?? "left",
          whiteSpace: "pre-wrap",
          wordBreak: "normal",
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
  imageSlots: ImageSlot[] = [],
  options: Pick<PublishedFrame, "referenceImage" | "generatedImage"> = {}
): PublishedFrame {
  return { size, background, layers, textSlots, imageSlots, ...options };
}

function friendlyPackage(): PublishedTemplatePackage {
  return {
    packageVersion: 1,
    packageKey: "contentgate-localized-ads-set-a-v1",
    publicName: "Set A - Local Content Friendly",
    frames: {
      square: frame(
        "square",
        FIGMA_WARM_A,
        [
          { kind: "rect", x: 0, y: 0, w: 1080, h: 1080, color: WHITE },
          { kind: "rect", x: 660, y: 110, w: 300, h: 850, color: WARM, radius: 28 },
          { kind: "brand", x: 72, y: 70, scale: 1.25 },
          { kind: "dashboard", x: 560, y: 250, w: 430, h: 330 },
          { kind: "rule", x: 72, y: 455, w: 116, h: 12, color: RUST },
        ],
        [
          { field: "local_detail", x: 97.2, y: 594, w: 777.6, h: 48.6, fontSize: 18, lineHeight: 1.1, weight: 600, color: RUST, maxChars: 74, maxLines: 1, lineChars: 60, family: "Inter" },
          { field: "headline", x: 97.2, y: 648, w: 885.6, h: 172.8, fontSize: 66.96, lineHeight: 0.98, weight: 700, color: GREEN, maxChars: 58, maxLines: 2, lineChars: 27, fallback: "Local content, made on brand.", family: "Inter" },
          { field: "subheadline", x: 97.2, y: 826.2, w: 799.2, h: 81, fontSize: 27, lineHeight: 1.18, weight: 400, color: MUTED, maxChars: 130, maxLines: 2, lineChars: 58, family: "Inter" },
          { field: "cta", x: 97.2, y: 945, w: 367.2, h: 59.4, fontSize: 22.68, lineHeight: 1.04, weight: 600, color: WHITE, maxChars: 28, maxLines: 1, align: "center", family: "Inter" },
          { field: "proof_note", x: 507.6, y: 945, w: 453.6, h: 59.4, fontSize: 20.52, lineHeight: 1.04, weight: 500, color: TEAL, maxChars: 64, maxLines: 1, lineChars: 42, family: "Inter" },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-a/square.png",
          generatedImage: "/template-packages/contentgate/set-a/backgrounds/square.png",
        }
      ),
      story: frame(
        "story",
        FIGMA_WARM_A,
        [
          { kind: "rect", x: 0, y: 0, w: 1080, h: 1030, color: WARM },
          { kind: "brand", x: 86, y: 72, scale: 1.5 },
          { kind: "dashboard", x: 86, y: 210, w: 908, h: 730 },
          { kind: "rule", x: 86, y: 1015, w: 112, h: 12, color: RUST },
        ],
        [
          { field: "local_detail", x: 97.2, y: 940.8, w: 842.4, h: 76.8, fontSize: 18, lineHeight: 1.1, weight: 600, color: RUST, maxChars: 74, maxLines: 1, lineChars: 60, family: "Inter" },
          { field: "headline", x: 97.2, y: 1036.8, w: 885.6, h: 249.6, fontSize: 92.88, lineHeight: 0.94, weight: 700, color: GREEN, maxChars: 58, maxLines: 3, lineChars: 18, family: "Inter" },
          { field: "subheadline", x: 97.2, y: 1344, w: 842.4, h: 163.2, fontSize: 38.88, lineHeight: 1.18, weight: 400, color: MUTED, maxChars: 130, maxLines: 3, lineChars: 40, family: "Inter" },
          { field: "cta", x: 97.2, y: 1584, w: 885.6, h: 105.6, fontSize: 34.56, lineHeight: 1.04, weight: 600, color: WHITE, maxChars: 28, maxLines: 1, align: "center", family: "Inter" },
          { field: "proof_note", x: 97.2, y: 1737.6, w: 885.6, h: 67.2, fontSize: 25.92, lineHeight: 1.04, weight: 500, color: TEAL, maxChars: 64, maxLines: 1, lineChars: 48, align: "center", family: "Inter" },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-a/story.png",
          generatedImage: "/template-packages/contentgate/set-a/backgrounds/story.png",
        }
      ),
      link_ad: frame(
        "link_ad",
        FIGMA_WARM_A,
        [
          { kind: "rect", x: 0, y: 0, w: 1200, h: 628, color: WHITE },
          { kind: "rect", x: 760, y: 54, w: 330, h: 520, color: WARM, radius: 28 },
          { kind: "brand", x: 66, y: 58, scale: 1.05 },
          { kind: "dashboard", x: 650, y: 150, w: 470, h: 330 },
          { kind: "rule", x: 66, y: 242, w: 104, h: 10, color: RUST },
        ],
        [
          { field: "local_detail", x: 72, y: 134, w: 504, h: 34.54, fontSize: 14.5068, lineHeight: 1.1, weight: 600, color: RUST, maxChars: 74, maxLines: 1, lineChars: 50, family: "Inter" },
          { field: "headline", x: 72, y: 207.24, w: 576, h: 125.6, fontSize: 60, lineHeight: 0.98, weight: 700, color: GREEN, maxChars: 58, maxLines: 3, lineChars: 20, family: "Inter" },
          { field: "subheadline", x: 72, y: 374, w: 528, h: 75.36, fontSize: 21.98, lineHeight: 1.22, weight: 400, color: MUTED, maxChars: 112, maxLines: 3, lineChars: 40, family: "Inter" },
          { field: "cta", x: 72, y: 477.28, w: 252, h: 56.52, fontSize: 20.096, lineHeight: 1.04, weight: 600, color: WHITE, maxChars: 28, maxLines: 1, align: "center", family: "Inter" },
          { field: "proof_note", x: 348, y: 477.28, w: 288, h: 56.52, fontSize: 16.328, lineHeight: 1.04, weight: 500, color: TEAL, maxChars: 64, maxLines: 2, lineChars: 32, family: "Inter" },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-a/link-ad.png",
          generatedImage: "/template-packages/contentgate/set-a/backgrounds/link-ad.png",
        }
      ),
      leaderboard: frame(
        "leaderboard",
        FIGMA_WARM_A,
        [
          { kind: "brand", x: 18, y: 27, scale: 0.72 },
          { kind: "rule", x: 190, y: 18, w: 5, h: 54, color: RUST },
        ],
        [
          { field: "headline", x: 250, y: 16, w: 355, h: 28, fontSize: 20, lineHeight: 1.04, weight: 700, color: GREEN, maxChars: 31, maxLines: 1, lineChars: 31, family: "Inter" },
          { field: "subheadline", x: 250, y: 46, w: 260, h: 20, fontSize: 13, lineHeight: 1.04, weight: 400, color: MUTED, maxChars: 78, maxLines: 1, lineChars: 42, family: "Inter" },
          { field: "cta", x: 560, y: 24, w: 132, h: 42, fontSize: 15, lineHeight: 1.04, weight: 600, color: WHITE, maxChars: 18, maxLines: 1, align: "center", family: "Inter" },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-a/leaderboard.png",
          generatedImage: "/template-packages/contentgate/set-a/backgrounds/leaderboard.png",
        }
      ),
      medium_rectangle: frame(
        "medium_rectangle",
        FIGMA_WARM_A,
        [
          { kind: "rule", x: 22, y: 18, w: 44, h: 4, color: RUST },
          { kind: "brand", x: 22, y: 31, scale: 0.62 },
          { kind: "dashboard", x: 204, y: 72, w: 70, h: 48, compact: true },
        ],
        [
          { field: "headline", x: 24, y: 69, w: 252, h: 62, fontSize: 29, lineHeight: 0.96, weight: 700, color: GREEN, maxChars: 34, maxLines: 2, lineChars: 15, family: "Inter" },
          { field: "subheadline", x: 24, y: 133, w: 232, h: 42, fontSize: 13, lineHeight: 1.16, weight: 400, color: MUTED, maxChars: 54, maxLines: 2, lineChars: 29, family: "Inter" },
          { field: "cta", x: 24, y: 200, w: 142, h: 32, fontSize: 13, lineHeight: 1.04, weight: 600, color: WHITE, maxChars: 18, maxLines: 1, align: "center", family: "Inter" },
          { field: "proof_note", x: 176, y: 200, w: 92, h: 32, fontSize: 10, lineHeight: 1.04, weight: 500, color: TEAL, maxChars: 24, maxLines: 1, family: "Inter" },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-a/medium-rectangle.png",
          generatedImage: "/template-packages/contentgate/set-a/backgrounds/medium-rectangle.png",
        }
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
        WARM,
        [
          { kind: "rect", x: 0, y: 0, w: 1080, h: 1080, color: FOREST },
          { kind: "rect", x: 62, y: 62, w: 956, h: 956, color: WARM, radius: 34 },
          { kind: "brand", x: 100, y: 102, scale: 1.18 },
          { kind: "dashboard", x: 550, y: 220, w: 390, h: 310, dark: true },
          { kind: "rule", x: 100, y: 430, w: 116, h: 12, color: RUST },
        ],
        [
          { field: "headline", x: 72, y: 591, w: 864, h: 151.2, fontSize: 62.64, lineHeight: 0.96, weight: 700, color: GREEN, maxChars: 64, maxLines: 2, lineChars: 27, family: "Inter" },
          { field: "subheadline", x: 72.36, y: 772.2, w: 723.6, h: 86.4, fontSize: 24.84, lineHeight: 1.22, weight: 400, color: MUTED, maxChars: 132, maxLines: 3, lineChars: 48, family: "Inter" },
          { field: "cta", x: 72.36, y: 912.6, w: 324, h: 59.4, fontSize: 21.6, lineHeight: 1.04, weight: 600, color: WHITE, maxChars: 30, maxLines: 1, align: "center", family: "Inter" },
          { field: "proof_note", x: 432, y: 912.6, w: 496.8, h: 59.4, fontSize: 19.44, lineHeight: 1.12, weight: 500, color: TEAL, maxChars: 64, maxLines: 1, lineChars: 44, family: "Inter" },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-b/square.png",
          generatedImage: "/template-packages/contentgate/set-b/backgrounds/square.png",
        }
      ),
      portrait: frame(
        "portrait",
        WARM,
        [
          { kind: "rect", x: 0, y: 0, w: 1080, h: 1350, color: FOREST },
          { kind: "brand", x: 82, y: 80, scale: 1.3, light: true },
          { kind: "dashboard", x: 82, y: 210, w: 916, h: 500, dark: true },
          { kind: "rule", x: 82, y: 780, w: 112, h: 12, color: RUST },
        ],
        [
          { field: "headline", x: 81, y: 742.5, w: 842.4, h: 189, fontSize: 64.8, lineHeight: 0.96, weight: 700, color: GREEN, maxChars: 64, maxLines: 3, lineChars: 22, family: "Inter" },
          { field: "subheadline", x: 81, y: 965.25, w: 799.2, h: 108, fontSize: 27, lineHeight: 1.22, weight: 400, color: MUTED, maxChars: 132, maxLines: 3, lineChars: 46, family: "Inter" },
          { field: "cta", x: 81, y: 1140.75, w: 432, h: 70.2, fontSize: 21.6, lineHeight: 1.04, weight: 600, color: WHITE, maxChars: 30, maxLines: 1, align: "center", family: "Inter" },
          { field: "proof_note", x: 550.8, y: 1140.75, w: 399.6, h: 70.2, fontSize: 19.44, lineHeight: 1.12, weight: 500, color: TEAL, maxChars: 64, maxLines: 2, lineChars: 34, family: "Inter" },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-b/portrait.png",
          generatedImage: "/template-packages/contentgate/set-b/backgrounds/portrait.png",
        }
      ),
      story: frame(
        "story",
        WARM,
        [],
        [
          { field: "headline", x: 86.4, y: 1171.2, w: 885.6, h: 249.6, fontSize: 79.92, lineHeight: 0.94, weight: 700, color: GREEN, maxChars: 64, maxLines: 3, lineChars: 20, family: "Inter" },
          { field: "subheadline", x: 86.4, y: 1468.8, w: 842.4, h: 144, fontSize: 35.64, lineHeight: 1.22, weight: 400, color: MUTED, maxChars: 132, maxLines: 3, lineChars: 40, family: "Inter" },
          { field: "cta", x: 86.4, y: 1680, w: 907.2, h: 103.68, fontSize: 32.4, lineHeight: 1.04, weight: 600, color: WHITE, maxChars: 30, maxLines: 1, align: "center", family: "Inter" },
          { field: "proof_note", x: 86.4, y: 1814.4, w: 907.2, h: 48, fontSize: 23.76, lineHeight: 1.1, weight: 500, color: TEAL, maxChars: 64, maxLines: 1, lineChars: 46, align: "center", family: "Inter" },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-b/story.png",
          generatedImage: "/template-packages/contentgate/set-b/backgrounds/story.png",
        }
      ),
      link_ad: frame(
        "link_ad",
        WARM,
        [],
        [
          { field: "headline", x: 66, y: 176, w: 528, h: 119.32, fontSize: 50, lineHeight: 0.96, weight: 700, color: GREEN, maxChars: 58, maxLines: 3, lineChars: 23, family: "Inter" },
          { field: "subheadline", x: 66, y: 332, w: 480, h: 75.36, fontSize: 21.98, lineHeight: 1.22, weight: 400, color: MUTED, maxChars: 112, maxLines: 3, lineChars: 40, family: "Inter" },
          { field: "cta", x: 66, y: 461.58, w: 264, h: 53.38, fontSize: 18.84, lineHeight: 1.04, weight: 600, color: WHITE, maxChars: 28, maxLines: 1, align: "center", family: "Inter" },
          { field: "proof_note", x: 360, y: 461.58, w: 264, h: 53.38, fontSize: 15.7, lineHeight: 1.12, weight: 500, color: TEAL, maxChars: 64, maxLines: 2, lineChars: 32, family: "Inter" },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-b/link-ad.png",
          generatedImage: "/template-packages/contentgate/set-b/backgrounds/link-ad.png",
        }
      ),
      medium_rectangle: frame(
        "medium_rectangle",
        WARM,
        [],
        [
          { field: "headline", x: 22, y: 76, w: 156, h: 62, fontSize: 27, lineHeight: 0.95, weight: 700, color: GREEN, maxChars: 34, maxLines: 3, lineChars: 9, family: "Inter" },
          { field: "subheadline", x: 22, y: 151, w: 244, h: 34, fontSize: 13, lineHeight: 1.16, weight: 400, color: MUTED, maxChars: 54, maxLines: 2, lineChars: 29, family: "Inter" },
          { field: "cta", x: 22, y: 198, w: 98, h: 31, fontSize: 13, lineHeight: 1.04, weight: 600, color: WHITE, maxChars: 18, maxLines: 1, align: "center", family: "Inter" },
          { field: "proof_note", x: 132, y: 198, w: 134, h: 31, fontSize: 10, lineHeight: 1.1, weight: 500, color: TEAL, maxChars: 24, maxLines: 1, family: "Inter" },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-b/medium-rectangle.png",
          generatedImage: "/template-packages/contentgate/set-b/backgrounds/medium-rectangle.png",
        }
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
  const { pkg, frameSpec } = resolvePublishedFrame(
    input.layoutKey,
    input.sizeKey,
    input.definition
  );
  if (!pkg || !frameSpec) return null;
  const dimensions = TEMPLATE_OUTPUT_SIZES[input.sizeKey];
  const renderedImage = input.original
    ? frameSpec.referenceImage
    : frameSpec.generatedImage;

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
