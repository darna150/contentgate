import React from "react";

import type { TemplateRenderInput } from "./template-renderer";
import { TEMPLATE_OUTPUT_SIZES, type TemplateSizeKey } from "./template-contract";
import { fitCopy, pickCopy } from "./render-copy";

type RenderResult = {
  element: React.ReactElement;
  w: number;
  h: number;
};

type Variant = "friendly" | "premium";

const GREEN = "#12312B";
const TEAL = "#0E5F58";
const MINT = "#DDEDE5";
const WARM = "#F7F2E8";
const RUST = "#B85D40";
const INK = "#172521";
const MUTED = "#52615B";
const WHITE = "#FFFFFF";

function variantFor(layoutKey: string): Variant {
  return layoutKey.includes("premium") ? "premium" : "friendly";
}

function text(fields: Record<string, string>, keys: string[], fallback: string) {
  return pickCopy(fields, keys).trim() || fallback;
}

function fit(value: string, maxChars: number, maxLines = 1) {
  return fitCopy(value, { maxChars, maxLines });
}

function Logo({ light = false, scale = 1 }: { light?: boolean; scale?: number }) {
  const fg = light ? WHITE : GREEN;
  const bg = light ? GREEN : MINT;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 * scale }}>
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
            background: bg,
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
              background: TEAL,
            }}
          />
        ))}
      </div>
      <div
        style={{
          color: fg,
          fontFamily: "ContentGate Sans",
          fontSize: 25 * scale,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        ContentGate
      </div>
    </div>
  );
}

function ProductMockup({ compact = false }: { compact?: boolean }) {
  const cardCount = compact ? 2 : 3;
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: compact ? 14 : 24,
        border: "2px solid #DCE5DE",
        background: WHITE,
        boxShadow: "0 30px 70px rgba(18,49,43,.16)",
      }}
    >
      <div style={{ display: "flex", width: "22%", height: "100%", background: GREEN }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: compact ? 12 : 18,
          width: "78%",
          padding: compact ? 18 : 30,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "46%", height: compact ? 9 : 14, borderRadius: 99, background: GREEN }} />
          <div style={{ width: "18%", height: compact ? 18 : 28, borderRadius: 99, background: MINT }} />
        </div>
        <div style={{ display: "flex", gap: compact ? 12 : 18 }}>
          {Array.from({ length: cardCount }).map((_, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                gap: compact ? 5 : 8,
                width: `${100 / cardCount}%`,
                height: compact ? 76 : 148,
                padding: compact ? 10 : 16,
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
            height: compact ? 26 : 44,
            marginTop: "auto",
            padding: compact ? "0 12px" : "0 18px",
            borderRadius: 999,
            background: WARM,
          }}
        >
          <div style={{ width: compact ? 8 : 14, height: compact ? 8 : 14, borderRadius: 99, background: RUST }} />
          <div style={{ width: "54%", height: compact ? 5 : 8, borderRadius: 99, background: TEAL }} />
        </div>
      </div>
    </div>
  );
}

function Layout({
  input,
  sizeKey,
}: {
  input: TemplateRenderInput;
  sizeKey: TemplateSizeKey;
}) {
  const { fields, layoutKey } = input;
  const variant = variantFor(layoutKey);
  const premium = variant === "premium";
  const headline = text(fields, ["headline"], "Local content, made on brand.");
  const subheadline = text(
    fields,
    ["subheadline", "supportCopy", "body"],
    "Give every branch, dealer, or local team approved assets and templates they can customize for their market."
  );
  const localDetail = text(
    fields,
    ["local_detail", "proof_note", "kicker"],
    "Swap language, dates, offers, images, and location details."
  );
  const cta = text(fields, ["cta"], "See how it works");
  const proof = text(
    fields,
    ["proof_note", "tagline"],
    "No design skills needed. Controlled for brand."
  );

  const background = premium ? WARM : WHITE;
  const field = premium ? GREEN : WARM;
  const lightBrand = premium && (sizeKey === "story" || sizeKey === "portrait");

  const copyColumn = (
    width: number,
    headlineSize: number,
    bodySize: number,
    ctaHeight: number,
    compact = false
  ) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        gap: compact ? 9 : 22,
      }}
    >
      <div
        style={{
          display: "flex",
          width: compact ? 52 : 112,
          height: compact ? 5 : 12,
          borderRadius: 999,
          background: RUST,
        }}
      />
      <div
        data-template-field="headline"
        style={{
          display: "flex",
          color: INK,
          fontFamily: "ContentGate Sans",
          fontSize: headlineSize,
          fontWeight: 800,
          lineHeight: 0.98,
          whiteSpace: "pre-wrap",
          overflow: "hidden",
        }}
      >
        {fit(headline, compact ? 34 : 64, compact ? 2 : 3)}
      </div>
      <div
        data-template-field="subheadline"
        style={{
          display: "flex",
          color: MUTED,
          fontFamily: "ContentGate Sans",
          fontSize: bodySize,
          fontWeight: 400,
          lineHeight: 1.24,
          whiteSpace: "pre-wrap",
          overflow: "hidden",
        }}
      >
        {fit(subheadline, compact ? 68 : 132, compact ? 3 : 4)}
      </div>
      {!compact && (
        <div
          data-template-field="local_detail"
          style={{
            display: "flex",
            color: TEAL,
            fontFamily: "ContentGate Sans",
            fontSize: bodySize * 0.9,
            fontWeight: 700,
            lineHeight: 1.18,
            whiteSpace: "pre-wrap",
            overflow: "hidden",
          }}
        >
          {fit(localDetail, 72, 2)}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: compact ? 10 : 24 }}>
        <div
          data-template-field="cta"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: compact ? 96 : 220,
            height: ctaHeight,
            padding: `0 ${compact ? 18 : 30}px`,
            borderRadius: 999,
            background: GREEN,
            color: WHITE,
            fontFamily: "ContentGate Sans",
            fontSize: compact ? 13 : bodySize,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {fit(cta, compact ? 14 : 28)}
        </div>
        <div
          data-template-field="proof_note"
          style={{
            display: "flex",
            color: TEAL,
            fontFamily: "ContentGate Sans",
            fontSize: compact ? 10 : bodySize * 0.82,
            fontWeight: 700,
            lineHeight: 1.1,
            overflow: "hidden",
          }}
        >
          {fit(proof, compact ? 24 : 64, compact ? 2 : 2)}
        </div>
      </div>
    </div>
  );

  if (sizeKey === "leaderboard") {
    return (
      <div style={{ display: "flex", width: "100%", height: "100%", background, alignItems: "center", padding: 18, boxSizing: "border-box", gap: 26 }}>
        <Logo scale={0.75} />
        <div style={{ display: "flex", flexDirection: "column", width: 308, gap: 5 }}>
          <div data-template-field="headline" style={{ display: "flex", color: INK, fontFamily: "ContentGate Sans", fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
            {fit(headline, 45)}
          </div>
          <div data-template-field="subheadline" style={{ display: "flex", color: MUTED, fontFamily: "ContentGate Sans", fontSize: 12, fontWeight: 400 }}>
            {fit(subheadline, 58)}
          </div>
        </div>
        <div data-template-field="cta" style={{ display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "auto", width: 118, height: 40, borderRadius: 999, background: GREEN, color: WHITE, fontFamily: "ContentGate Sans", fontSize: 14, fontWeight: 700 }}>
          {fit(cta, 14)}
        </div>
      </div>
    );
  }

  if (sizeKey === "medium_rectangle") {
    return (
      <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background, padding: 22, boxSizing: "border-box" }}>
        <div style={{ position: "absolute", left: 22, top: 18, width: 44, height: 4, borderRadius: 999, background: RUST }} />
        <div style={{ display: "flex", position: "absolute", left: 22, top: 30 }}>
          <Logo scale={0.62} />
        </div>
        <div style={{ display: "flex", position: "absolute", right: 28, top: 70, width: 70, height: 48 }}>
          <ProductMockup compact />
        </div>
        <div style={{ display: "flex", position: "absolute", left: 22, top: 76 }}>
          {copyColumn(166, 27, 13, 31, true)}
        </div>
      </div>
    );
  }

  if (sizeKey === "link_ad" || sizeKey === "feed") {
    return (
      <div style={{ display: "flex", width: "100%", height: "100%", background, padding: 66, boxSizing: "border-box", gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", width: 532 }}>
          <Logo scale={1.05} />
          <div style={{ display: "flex", marginTop: 52 }}>{copyColumn(520, 60, 22, 54)}</div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
          <ProductMockup compact={false} />
        </div>
      </div>
    );
  }

  if (sizeKey === "story" || sizeKey === "portrait") {
    return (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background, boxSizing: "border-box" }}>
        <div style={{ display: "flex", flexDirection: "column", height: sizeKey === "story" ? "53%" : "47%", background: field, padding: "70px 86px", boxSizing: "border-box", gap: 70 }}>
          <Logo light={lightBrand} scale={1.5} />
          <ProductMockup compact={false} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: sizeKey === "story" ? "70px 86px" : "62px 82px", boxSizing: "border-box" }}>
          {copyColumn(900, sizeKey === "story" ? 76 : 64, sizeKey === "story" ? 34 : 27, sizeKey === "story" ? 96 : 70)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background, padding: 72, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Logo scale={1.45} />
        <div style={{ display: "flex", width: 520, height: 390 }}>
          <ProductMockup compact={false} />
        </div>
      </div>
      <div style={{ display: "flex", marginTop: 70 }}>{copyColumn(880, 62, 25, 60)}</div>
    </div>
  );
}

export function renderContentGate(input: TemplateRenderInput): RenderResult {
  const size = TEMPLATE_OUTPUT_SIZES[input.sizeKey];
  return {
    element: <Layout input={input} sizeKey={input.sizeKey} />,
    w: size.w,
    h: size.h,
  };
}
