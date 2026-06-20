import React from "react";
import type { SizeKey } from "./creative";
import { fitCopy, pickCopy } from "./render-copy";

type Fields = Record<string, string>;

type RenderInput = {
  sizeKey?: SizeKey;
  fields: Fields;
  disclaimer: string;
  origin: string;
  original?: boolean;
};

type RenderResult = {
  element: React.ReactElement;
  w: number;
  h: number;
  density: CaniGuardDensity;
};

export type CaniGuardDensity = "short" | "standard" | "long";

// ─── Colors ───────────────────────────────────────────────────────────────────

const NAVY = "#061D4C";
const BLUE = "#0667D8";
const MUTED = "#1F2D44";

// ─── Square contract (1080×1080) ──────────────────────────────────────────────
//
// Text zone: left column from y≈192 down to y≈672 (above the locked disease
// icon strip at ~y=700). The CTA button is baked into the background art.
// Editable fields: headline (last line renders blue), supportCopy.

type SquareContract = {
  headline: { fontSize: number; maxChars: number; maxLines: number; containerHeight: number };
  rule: { width: number };
  body: { fontSize: number; maxChars: number; maxLines: number; containerHeight: number };
  headlineRuleGap: number;
  ruleBodyGap: number;
};

const SQUARE_CONTRACTS: Record<CaniGuardDensity, SquareContract> = {
  short: {
    headline: { fontSize: 76, maxChars: 50, maxLines: 3, containerHeight: 250 },
    rule: { width: 98 },
    body: { fontSize: 29, maxChars: 86, maxLines: 2, containerHeight: 90 },
    headlineRuleGap: 24,
    ruleBodyGap: 30,
  },
  standard: {
    headline: { fontSize: 72, maxChars: 50, maxLines: 3, containerHeight: 235 },
    rule: { width: 98 },
    body: { fontSize: 27, maxChars: 104, maxLines: 3, containerHeight: 118 },
    headlineRuleGap: 24,
    ruleBodyGap: 34,
  },
  long: {
    headline: { fontSize: 64, maxChars: 50, maxLines: 3, containerHeight: 215 },
    rule: { width: 98 },
    body: { fontSize: 24, maxChars: 120, maxLines: 4, containerHeight: 140 },
    headlineRuleGap: 20,
    ruleBodyGap: 28,
  },
};

// ─── Density ──────────────────────────────────────────────────────────────────

function supportCopy(fields: Fields) {
  return pickCopy(fields, ["supportCopy", "supportingCopy", "supporting", "subline", "body"]);
}

export function caniGuard5LayoutDensity(fields: Fields): CaniGuardDensity {
  const headline = fields.headline || "";
  const body = supportCopy(fields);
  const headlineLines = headline ? headline.split(/\r?\n/).length : 0;
  const bodyLen = body.replace(/\s+/g, " ").trim().length;

  if (headlineLines <= 2 && bodyLen <= 48) return "short";
  if (headlineLines >= 3 && bodyLen >= 80) return "long";
  return "standard";
}

// ─── Components ───────────────────────────────────────────────────────────────

function assetUrl(origin: string, mode: "reference" | "background") {
  const path = `/assets/caniguard5/caniguard5-square-${mode}.jpg`;
  return origin ? new URL(path, origin).toString() : path;
}

function ColorHeadline({
  value,
  contract,
}: {
  value: string;
  contract: SquareContract["headline"];
}) {
  const fitted = fitCopy(value, {
    maxChars: contract.maxChars,
    maxLines: contract.maxLines,
  });
  const lines = fitted.split(/\r?\n/);
  return (
    <div
      data-template-field="headline"
      style={{
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        width: 540,
        maxHeight: contract.containerHeight,
        overflow: "hidden",
        fontFamily: "CaniGuard Roboto",
        fontSize: contract.fontSize,
        fontWeight: 800,
        lineHeight: 1.02,
        letterSpacing: "-0.04em",
      }}
    >
      {lines.map((line, i) => (
        <div
          key={i}
          data-template-content
          style={{
            display: "flex",
            flexShrink: 0,
            color: i === lines.length - 1 ? BLUE : NAVY,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

function BodyText({
  value,
  contract,
}: {
  value: string;
  contract: SquareContract["body"];
}) {
  const fitted = fitCopy(value, {
    maxChars: contract.maxChars,
    maxLines: contract.maxLines,
  });
  return (
    <div
      data-template-field="supportCopy"
      style={{
        display: "flex",
        flexShrink: 0,
        width: 475,
        maxHeight: contract.containerHeight,
        overflow: "hidden",
        color: MUTED,
        fontFamily: "CaniGuard Roboto",
        fontSize: contract.fontSize,
        fontWeight: 400,
        lineHeight: 1.35,
        whiteSpace: "pre-wrap",
      }}
    >
      <span data-template-content style={{ display: "block", width: "100%" }}>
        {fitted}
      </span>
    </div>
  );
}

function Spacer({ height }: { height: number }) {
  return <div aria-hidden="true" style={{ display: "flex", flexShrink: 0, height }} />;
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

function SquareCanvas({
  fields,
  origin,
  original,
  density,
}: Omit<RenderInput, "sizeKey"> & { density: CaniGuardDensity }) {
  const c = SQUARE_CONTRACTS[density];
  const body = supportCopy(fields);

  return (
    <div
      data-caniguard-format="square"
      data-caniguard-density={density}
      style={{
        position: "relative",
        display: "flex",
        width: 1080,
        height: 1080,
        overflow: "hidden",
        backgroundImage: `url(${assetUrl(origin, original ? "reference" : "background")})`,
        backgroundSize: "1080px 1080px",
        backgroundRepeat: "no-repeat",
      }}
    >
      {!original && (
        <div
          data-template-stack
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            left: 54,
            top: 192,
            width: 540,
            // maxHeight keeps the entire text block above the locked disease
            // icon strip baked into the background at ~y=700.
            maxHeight: 480,
            overflow: "hidden",
          }}
        >
          <ColorHeadline value={fields.headline || ""} contract={c.headline} />
          <Spacer height={c.headlineRuleGap} />
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              flexShrink: 0,
              width: c.rule.width,
              height: 7,
              borderRadius: 7,
              backgroundColor: BLUE,
            }}
          />
          <Spacer height={c.ruleBodyGap} />
          <BodyText value={body} contract={c.body} />
        </div>
      )}
    </div>
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function caniGuard5Dimensions() {
  return { w: 1080, h: 1080 };
}

export function renderCaniGuard5(input: RenderInput): RenderResult {
  const density = caniGuard5LayoutDensity(input.fields);
  return {
    element: (
      <SquareCanvas
        fields={input.fields}
        origin={input.origin}
        disclaimer={input.disclaimer}
        original={input.original}
        density={density}
      />
    ),
    w: 1080,
    h: 1080,
    density,
  };
}
