import React from "react";
import type { SizeKey } from "./creative";
import { fitCopy, pickCopy } from "./render-copy";

type Fields = Record<string, string>;

type RenderInput = {
  layoutKey?: string;
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
  density: VitalBiteDensity;
};

export type VitalBiteDensity = "short" | "standard" | "long";

// ─── Colors ───────────────────────────────────────────────────────────────────

const TEAL = "#1A4A3A";
const BODY = "#2E2E2E";
const WHITE = "#FFFFFF";

// ─── Square contract (1080×1080) ──────────────────────────────────────────────
//
// Text zone: left column from y≈212 (kicker top) down to y≈820 (above the
// locked benefit icon strip baked into the background art).
// Editable fields: kicker, headline, supportCopy, cta.
// The headline is authored as explicit-newline phrases ("Fresher breath.\n
// Cleaner teeth.\nHappier dogs.") — no character-width re-wrapping applied.

type SquareContract = {
  kicker: { fontSize: number; maxChars: number; height: number };
  kickerHeadlineGap: number;
  headline: { fontSize: number; maxChars: number; maxLines: number; containerHeight: number };
  headlineBodyGap: number;
  body: { fontSize: number; maxChars: number; maxLines: number; containerHeight: number };
  bodyCtaGap: number;
  cta: { fontSize: number; maxChars: number; minWidth: number; maxWidth: number; height: number };
};

const SQUARE_CONTRACTS: Record<VitalBiteDensity, SquareContract> = {
  short: {
    kicker: { fontSize: 30, maxChars: 36, height: 52 },
    kickerHeadlineGap: 12,
    headline: { fontSize: 90, maxChars: 50, maxLines: 3, containerHeight: 285 },
    headlineBodyGap: 14,
    body: { fontSize: 27, maxChars: 76, maxLines: 2, containerHeight: 72 },
    bodyCtaGap: 18,
    cta: { fontSize: 27, maxChars: 20, minWidth: 200, maxWidth: 340, height: 66 },
  },
  standard: {
    kicker: { fontSize: 28, maxChars: 36, height: 50 },
    kickerHeadlineGap: 14,
    headline: { fontSize: 86, maxChars: 50, maxLines: 3, containerHeight: 268 },
    headlineBodyGap: 16,
    body: { fontSize: 26, maxChars: 82, maxLines: 2, containerHeight: 66 },
    bodyCtaGap: 18,
    cta: { fontSize: 27, maxChars: 20, minWidth: 200, maxWidth: 340, height: 66 },
  },
  long: {
    kicker: { fontSize: 26, maxChars: 40, height: 48 },
    kickerHeadlineGap: 12,
    headline: { fontSize: 76, maxChars: 50, maxLines: 3, containerHeight: 240 },
    headlineBodyGap: 14,
    body: { fontSize: 24, maxChars: 96, maxLines: 3, containerHeight: 88 },
    bodyCtaGap: 16,
    cta: { fontSize: 25, maxChars: 22, minWidth: 200, maxWidth: 340, height: 60 },
  },
};

// ─── Density ──────────────────────────────────────────────────────────────────

function supportCopy(fields: Fields) {
  return pickCopy(fields, ["supporting", "supportCopy", "supportingCopy", "subline", "body"]);
}

export function vitalBiteLayoutDensity(fields: Fields): VitalBiteDensity {
  const headline = fields.headline || "";
  const body = supportCopy(fields);
  const headlineLines = headline ? headline.split(/\r?\n/).length : 0;
  const bodyLen = body.replace(/\s+/g, " ").trim().length;
  const kickerLen = (fields.kicker || "").trim().length;

  if (headlineLines <= 2 && bodyLen <= 40 && kickerLen <= 20) return "short";
  if (headlineLines >= 3 && bodyLen >= 66) return "long";
  return "standard";
}

// ─── Components ───────────────────────────────────────────────────────────────

function assetUrl(origin: string, mode: "reference" | "background") {
  const path = `/assets/vitalbite/vitalbite-square-${mode}.jpg`;
  return origin ? new URL(path, origin).toString() : path;
}

// Approximate glyph width at a given font size (Nunito Sans, no letter-spacing)
function glyphUnits(value: string) {
  return Array.from(value).reduce((total, ch) => {
    if (ch === " ") return total + 0.28;
    if (/[ilI1.,'|]/.test(ch)) return total + 0.28;
    if (/[mwMW@%&]/.test(ch)) return total + 0.82;
    if (/[A-Z]/.test(ch)) return total + 0.62;
    return total + 0.52;
  }, 0);
}

function KickerText({
  value,
  contract,
}: {
  value: string;
  contract: SquareContract["kicker"];
}) {
  const fitted = fitCopy(value, { maxChars: contract.maxChars, maxLines: 1 });
  return (
    <div
      data-template-field="kicker"
      style={{
        display: "flex",
        flexShrink: 0,
        width: 460,
        maxHeight: contract.height,
        overflow: "hidden",
        color: TEAL,
        fontFamily: "VitalBite Nunito Sans",
        fontSize: contract.fontSize,
        fontWeight: 500,
        lineHeight: 1.1,
        whiteSpace: "pre-wrap",
      }}
    >
      <span data-template-content style={{ display: "block", width: "100%" }}>
        {fitted}
      </span>
    </div>
  );
}

function HeadlineText({
  value,
  contract,
}: {
  value: string;
  contract: SquareContract["headline"];
}) {
  // Headline is authored as explicit-newline short phrases — preserve them,
  // just enforce maxLines and maxChars as a safety cap.
  const fitted = fitCopy(value, {
    maxChars: contract.maxChars,
    maxLines: contract.maxLines,
  });
  return (
    <div
      data-template-field="headline"
      style={{
        display: "flex",
        flexShrink: 0,
        width: 490,
        maxHeight: contract.containerHeight,
        overflow: "hidden",
        color: TEAL,
        fontFamily: "VitalBite Nunito Sans",
        fontSize: contract.fontSize,
        fontWeight: 800,
        lineHeight: 1.02,
        whiteSpace: "pre-wrap",
      }}
    >
      <span data-template-content style={{ display: "block", width: "100%" }}>
        {fitted}
      </span>
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
        width: 448,
        maxHeight: contract.containerHeight,
        overflow: "hidden",
        color: BODY,
        fontFamily: "VitalBite Nunito Sans",
        fontSize: contract.fontSize,
        fontWeight: 400,
        lineHeight: 1.3,
        whiteSpace: "pre-wrap",
      }}
    >
      <span data-template-content style={{ display: "block", width: "100%" }}>
        {fitted}
      </span>
    </div>
  );
}

function CtaButton({
  value,
  contract,
}: {
  value: string;
  contract: SquareContract["cta"];
}) {
  const fitted = fitCopy(value, { maxChars: contract.maxChars, maxLines: 1 });
  const hPad = 28;
  const measured = glyphUnits(fitted) * contract.fontSize * 1.06 + hPad * 2;
  const width = Math.min(contract.maxWidth, Math.max(contract.minWidth, measured));

  return (
    <div
      data-template-field="cta"
      style={{
        display: "flex",
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        width,
        height: contract.height,
        paddingLeft: hPad,
        paddingRight: hPad,
        boxSizing: "border-box",
        borderRadius: contract.height / 2,
        backgroundColor: TEAL,
        color: WHITE,
        fontFamily: "VitalBite Nunito Sans",
        fontSize: contract.fontSize,
        fontWeight: 700,
        overflow: "hidden",
        whiteSpace: "nowrap",
      }}
    >
      <span data-template-content>{fitted}</span>
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
}: Omit<RenderInput, "sizeKey" | "layoutKey"> & { density: VitalBiteDensity }) {
  const c = SQUARE_CONTRACTS[density];
  const body = supportCopy(fields);

  return (
    <div
      data-vitalbite-format="square"
      data-vitalbite-density={density}
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
            left: 52,
            top: 212,
            width: 490,
            // maxHeight keeps the stack above the locked benefit icons at ~y=820.
            maxHeight: 608,
            overflow: "hidden",
          }}
        >
          <KickerText value={fields.kicker || ""} contract={c.kicker} />
          <Spacer height={c.kickerHeadlineGap} />
          <HeadlineText value={fields.headline || ""} contract={c.headline} />
          <Spacer height={c.headlineBodyGap} />
          <BodyText value={body} contract={c.body} />
          <Spacer height={c.bodyCtaGap} />
          <CtaButton value={fields.cta || ""} contract={c.cta} />
        </div>
      )}
    </div>
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function vitalBiteDimensions() {
  return { w: 1080, h: 1080 };
}

export function renderVitalBite(input: RenderInput): RenderResult {
  const density = vitalBiteLayoutDensity(input.fields);
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
