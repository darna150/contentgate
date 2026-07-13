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

type Mask = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  radius?: number;
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
  masks?: Mask[];
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

function renderMask(mask: Mask, index: number) {
  return (
    <div
      key={index}
      aria-hidden="true"
      style={{
        position: "absolute",
        left: mask.x,
        top: mask.y,
        width: mask.w,
        height: mask.h,
        borderRadius: mask.radius ?? 0,
        background: mask.color,
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
  imageSlots: ImageSlot[] = [],
  options: Pick<PublishedFrame, "referenceImage" | "masks"> = {}
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
          { field: "local_detail", x: 97, y: 610, w: 620, h: 32, fontSize: 18, lineHeight: 1.1, weight: 800, color: RUST, maxChars: 74, maxLines: 1, lineChars: 50 },
          { field: "headline", x: 97, y: 675, w: 760, h: 122, fontSize: 68, lineHeight: 0.98, weight: 850, color: GREEN, maxChars: 58, maxLines: 2, lineChars: 24, fallback: "Local content, made on brand." },
          { field: "subheadline", x: 97, y: 838, w: 760, h: 66, fontSize: 29, lineHeight: 1.08, weight: 400, color: MUTED, maxChars: 130, maxLines: 2, lineChars: 47 },
          { field: "cta", x: 97, y: 945, w: 367, h: 60, fontSize: 24, lineHeight: 1, weight: 800, color: WHITE, maxChars: 28, maxLines: 1, align: "center", background: GREEN, radius: 999 },
          { field: "proof_note", x: 508, y: 967, w: 420, h: 29, fontSize: 21, lineHeight: 1.05, weight: 800, color: TEAL, maxChars: 64, maxLines: 1, lineChars: 42 },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-a/square.png",
          masks: [
            { x: 84, y: 600, w: 830, h: 316, color: FIGMA_WARM_A },
            { x: 88, y: 936, w: 870, h: 78, color: FIGMA_WARM_A },
          ],
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
          { field: "local_detail", x: 97, y: 980, w: 720, h: 42, fontSize: 20, lineHeight: 1.1, weight: 800, color: RUST, maxChars: 74, maxLines: 1, lineChars: 54 },
          { field: "headline", x: 97, y: 1040, w: 830, h: 260, fontSize: 74, lineHeight: 0.98, weight: 850, color: GREEN, maxChars: 58, maxLines: 3, lineChars: 18 },
          { field: "subheadline", x: 97, y: 1390, w: 870, h: 120, fontSize: 36, lineHeight: 1.2, weight: 400, color: MUTED, maxChars: 130, maxLines: 3, lineChars: 42 },
          { field: "cta", x: 97, y: 1583, w: 886, h: 105, fontSize: 35, lineHeight: 1, weight: 800, color: WHITE, maxChars: 28, maxLines: 1, align: "center", background: GREEN, radius: 999 },
          { field: "proof_note", x: 218, y: 1760, w: 650, h: 38, fontSize: 26, lineHeight: 1.1, weight: 800, color: TEAL, maxChars: 64, maxLines: 1, lineChars: 48, align: "center" },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-a/story.png",
          masks: [
            { x: 82, y: 960, w: 918, h: 590, color: FIGMA_WARM_A },
            { x: 82, y: 1570, w: 918, h: 245, color: FIGMA_WARM_A },
          ],
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
          { field: "local_detail", x: 72, y: 146, w: 540, h: 22, fontSize: 15, lineHeight: 1, weight: 800, color: RUST, maxChars: 74, maxLines: 1, lineChars: 50 },
          { field: "headline", x: 72, y: 187, w: 585, h: 172, fontSize: 60, lineHeight: 0.98, weight: 850, color: GREEN, maxChars: 58, maxLines: 3, lineChars: 20 },
          { field: "subheadline", x: 72, y: 378, w: 520, h: 72, fontSize: 23, lineHeight: 1.14, weight: 400, color: MUTED, maxChars: 112, maxLines: 3, lineChars: 40 },
          { field: "cta", x: 72, y: 477, w: 253, h: 56, fontSize: 20, lineHeight: 1, weight: 800, color: WHITE, maxChars: 28, maxLines: 1, align: "center", background: GREEN, radius: 999 },
          { field: "proof_note", x: 348, y: 490, w: 280, h: 34, fontSize: 16, lineHeight: 1.05, weight: 800, color: TEAL, maxChars: 64, maxLines: 2, lineChars: 32 },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-a/link-ad.png",
          masks: [
            { x: 58, y: 134, w: 590, h: 322, color: FIGMA_WARM_A },
            { x: 58, y: 464, w: 590, h: 78, color: FIGMA_WARM_A },
          ],
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
          { field: "headline", x: 250, y: 21, w: 292, h: 22, fontSize: 20, lineHeight: 1, weight: 850, color: GREEN, maxChars: 42, maxLines: 1 },
          { field: "subheadline", x: 250, y: 47, w: 300, h: 26, fontSize: 12, lineHeight: 1.05, weight: 400, color: MUTED, maxChars: 78, maxLines: 2, lineChars: 42 },
          { field: "cta", x: 560, y: 24, w: 132, h: 42, fontSize: 14, lineHeight: 1, weight: 800, color: WHITE, maxChars: 18, maxLines: 1, align: "center", background: GREEN, radius: 999 },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-a/leaderboard.png",
          masks: [
            { x: 246, y: 16, w: 310, h: 62, color: FIGMA_WARM_A },
            { x: 552, y: 18, w: 148, h: 54, color: FIGMA_WARM_A },
          ],
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
          { field: "headline", x: 24, y: 75, w: 190, h: 66, fontSize: 25, lineHeight: 1, weight: 850, color: GREEN, maxChars: 34, maxLines: 2, lineChars: 14 },
          { field: "subheadline", x: 24, y: 143, w: 200, h: 36, fontSize: 13.5, lineHeight: 1.08, weight: 400, color: MUTED, maxChars: 44, maxLines: 2, lineChars: 24 },
          { field: "cta", x: 24, y: 201, w: 142, h: 31, fontSize: 13, lineHeight: 1, weight: 800, color: WHITE, maxChars: 18, maxLines: 1, align: "center", background: GREEN, radius: 999 },
          { field: "proof_note", x: 177, y: 211, w: 100, h: 14, fontSize: 9.5, lineHeight: 1, weight: 800, color: TEAL, maxChars: 24, maxLines: 1 },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-a/medium-rectangle.png",
          masks: [
            { x: 18, y: 70, w: 260, h: 112, color: FIGMA_WARM_A },
            { x: 18, y: 196, w: 260, h: 42, color: FIGMA_WARM_A },
          ],
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
          { field: "headline", x: 72, y: 610, w: 690, h: 132, fontSize: 68, lineHeight: 0.95, weight: 850, color: GREEN, maxChars: 64, maxLines: 2, lineChars: 22 },
          { field: "subheadline", x: 72, y: 775, w: 720, h: 86, fontSize: 27, lineHeight: 1.15, weight: 400, color: MUTED, maxChars: 132, maxLines: 3, lineChars: 44 },
          { field: "cta", x: 72, y: 913, w: 325, h: 60, fontSize: 23, lineHeight: 1, weight: 800, color: WHITE, maxChars: 30, maxLines: 1, align: "center", background: GREEN, radius: 999 },
          { field: "proof_note", x: 432, y: 935, w: 520, h: 28, fontSize: 20, lineHeight: 1.05, weight: 800, color: TEAL, maxChars: 64, maxLines: 1, lineChars: 44 },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-b/square.png",
          masks: [
            { x: 62, y: 600, w: 910, h: 276, color: WARM },
            { x: 62, y: 902, w: 910, h: 84, color: WARM },
          ],
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
          { field: "headline", x: 82, y: 750, w: 820, h: 215, fontSize: 62, lineHeight: 0.98, weight: 850, color: GREEN, maxChars: 64, maxLines: 3, lineChars: 20 },
          { field: "subheadline", x: 82, y: 994, w: 840, h: 96, fontSize: 27, lineHeight: 1.16, weight: 400, color: MUTED, maxChars: 132, maxLines: 3, lineChars: 46 },
          { field: "cta", x: 82, y: 1142, w: 432, h: 70, fontSize: 22, lineHeight: 1, weight: 800, color: WHITE, maxChars: 30, maxLines: 1, align: "center", background: GREEN, radius: 999 },
          { field: "proof_note", x: 550, y: 1158, w: 430, h: 50, fontSize: 21, lineHeight: 1.12, weight: 800, color: TEAL, maxChars: 64, maxLines: 2, lineChars: 34 },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-b/portrait.png",
          masks: [
            { x: 68, y: 730, w: 940, h: 360, color: WARM },
            { x: 68, y: 1128, w: 930, h: 96, color: WARM },
          ],
        }
      ),
      story: frame(
        "story",
        WARM,
        [],
        [
          { field: "headline", x: 86, y: 1225, w: 890, h: 232, fontSize: 70, lineHeight: 0.98, weight: 850, color: GREEN, maxChars: 64, maxLines: 3, lineChars: 20 },
          { field: "subheadline", x: 86, y: 1486, w: 820, h: 130, fontSize: 35, lineHeight: 1.18, weight: 400, color: MUTED, maxChars: 132, maxLines: 3, lineChars: 40 },
          { field: "cta", x: 86, y: 1680, w: 908, h: 104, fontSize: 34, lineHeight: 1, weight: 800, color: WHITE, maxChars: 30, maxLines: 1, align: "center", background: GREEN, radius: 999 },
          { field: "proof_note", x: 245, y: 1830, w: 590, h: 42, fontSize: 25, lineHeight: 1.08, weight: 800, color: TEAL, maxChars: 64, maxLines: 1, lineChars: 46, align: "center" },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-b/story.png",
          masks: [
            { x: 70, y: 1200, w: 960, h: 430, color: WARM },
            { x: 70, y: 1665, w: 960, h: 220, color: WARM },
          ],
        }
      ),
      link_ad: frame(
        "link_ad",
        WARM,
        [],
        [
          { field: "headline", x: 66, y: 168, w: 585, h: 142, fontSize: 50, lineHeight: 0.96, weight: 850, color: GREEN, maxChars: 58, maxLines: 3, lineChars: 23 },
          { field: "subheadline", x: 66, y: 335, w: 520, h: 78, fontSize: 23, lineHeight: 1.14, weight: 400, color: MUTED, maxChars: 112, maxLines: 3, lineChars: 40 },
          { field: "cta", x: 66, y: 463, w: 263, h: 54, fontSize: 20, lineHeight: 1, weight: 800, color: WHITE, maxChars: 28, maxLines: 1, align: "center", background: GREEN, radius: 999 },
          { field: "proof_note", x: 360, y: 474, w: 280, h: 38, fontSize: 16, lineHeight: 1.05, weight: 800, color: TEAL, maxChars: 64, maxLines: 2, lineChars: 32 },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-b/link-ad.png",
          masks: [
            { x: 54, y: 158, w: 590, h: 265, color: WARM },
            { x: 54, y: 450, w: 590, h: 78, color: WARM },
          ],
        }
      ),
      medium_rectangle: frame(
        "medium_rectangle",
        WARM,
        [],
        [
          { field: "headline", x: 22, y: 70, w: 150, h: 74, fontSize: 26, lineHeight: 0.96, weight: 850, color: GREEN, maxChars: 34, maxLines: 3, lineChars: 11 },
          { field: "subheadline", x: 22, y: 151, w: 210, h: 34, fontSize: 13.5, lineHeight: 1.08, weight: 400, color: MUTED, maxChars: 44, maxLines: 2, lineChars: 24 },
          { field: "cta", x: 22, y: 199, w: 98, h: 30, fontSize: 12, lineHeight: 1, weight: 800, color: WHITE, maxChars: 18, maxLines: 1, align: "center", background: GREEN, radius: 999 },
          { field: "proof_note", x: 132, y: 210, w: 122, h: 14, fontSize: 9.5, lineHeight: 1, weight: 800, color: TEAL, maxChars: 24, maxLines: 1 },
        ],
        [],
        {
          referenceImage: "/template-packages/contentgate/set-b/medium-rectangle.png",
          masks: [
            { x: 16, y: 66, w: 164, h: 80, color: WARM },
            { x: 16, y: 148, w: 230, h: 42, color: WARM },
            { x: 16, y: 194, w: 244, h: 42, color: WARM },
          ],
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
        {frameSpec.referenceImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${input.origin}${frameSpec.referenceImage}`}
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
            {frameSpec.masks?.map(renderMask)}
            {frameSpec.imageSlots?.map((slot) => renderImageSlot(slot, input.fields))}
            {frameSpec.textSlots.map((slot) => renderTextSlot(slot, input.fields))}
          </>
        )}
      </div>
    ),
  };
}
