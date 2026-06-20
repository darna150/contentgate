import React from "react";
import type { SizeKey } from "./creative";
import { fitCopy } from "./render-copy";

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
  density: ApexLayoutDensity;
};

type Format = "square" | "story" | "flyer";
export type ApexLayoutDensity = "short" | "standard" | "long";

type TextContract = {
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily: "Apex Fraunces" | "Apex Nourd";
  fontSize: number;
  fontWeight: 400 | 700;
  lineHeight: number;
  color: string;
  maxChars: number;
  maxLines: number;
};

type FormatContract = {
  width: number;
  height: number;
  format: Format;
  fields: {
    kicker: TextContract;
    headline: TextContract;
    body: TextContract;
    cta?: TextContract;
  };
};

const GREEN = "#20372c";
const FLYER_GREEN = "#20342c";
const ORANGE = "#c96c3d";

const CONTRACTS: Record<Format, FormatContract> = {
  square: {
    width: 1080,
    height: 1080,
    format: "square",
    fields: {
      kicker: {
        x: 137.8,
        y: 279.3,
        width: 268.9,
        height: 50,
        fontFamily: "Apex Nourd",
        fontSize: 21.2,
        fontWeight: 700,
        lineHeight: 1.12,
        color: GREEN,
        maxChars: 42,
        maxLines: 2,
      },
      headline: {
        x: 76.7,
        y: 372.7,
        width: 420,
        height: 243.8,
        fontFamily: "Apex Fraunces",
        fontSize: 58.9,
        fontWeight: 700,
        lineHeight: 0.95,
        color: GREEN,
        maxChars: 58,
        maxLines: 4,
      },
      body: {
        x: 76.7,
        y: 659.5,
        width: 315.4,
        height: 96,
        fontFamily: "Apex Nourd",
        fontSize: 27.2,
        fontWeight: 400,
        lineHeight: 1.18,
        color: GREEN,
        maxChars: 72,
        maxLines: 3,
      },
      cta: {
        x: 88.9,
        y: 813.7,
        width: 252.7,
        height: 30.1,
        fontFamily: "Apex Nourd",
        fontSize: 25.2,
        fontWeight: 400,
        lineHeight: 1,
        color: "#ffffff",
        maxChars: 28,
        maxLines: 1,
      },
    },
  },
  story: {
    width: 1080,
    height: 1920,
    format: "story",
    fields: {
      kicker: {
        x: 162.8,
        y: 479.4,
        width: 342.2,
        height: 63.6,
        fontFamily: "Apex Nourd",
        fontSize: 26.9,
        fontWeight: 700,
        lineHeight: 1.12,
        color: GREEN,
        maxChars: 42,
        maxLines: 2,
      },
      headline: {
        x: 76.7,
        y: 606.9,
        width: 520,
        height: 357.1,
        fontFamily: "Apex Fraunces",
        fontSize: 70,
        fontWeight: 700,
        lineHeight: 1,
        color: GREEN,
        maxChars: 58,
        maxLines: 4,
      },
      body: {
        x: 76.7,
        y: 1072.6,
        width: 397.6,
        height: 135,
        fontFamily: "Apex Nourd",
        fontSize: 37.9,
        fontWeight: 400,
        lineHeight: 1.18,
        color: GREEN,
        maxChars: 72,
        maxLines: 3,
      },
      cta: {
        x: 99.4,
        y: 1252.9,
        width: 462.2,
        height: 46,
        fontFamily: "Apex Nourd",
        fontSize: 38.5,
        fontWeight: 400,
        lineHeight: 1,
        color: "#ffffff",
        maxChars: 28,
        maxLines: 1,
      },
    },
  },
  flyer: {
    width: 1414,
    height: 2000,
    format: "flyer",
    fields: {
      kicker: {
        x: 193.9,
        y: 441.3,
        width: 404,
        height: 75,
        fontFamily: "Apex Nourd",
        fontSize: 31.8,
        fontWeight: 700,
        lineHeight: 1.12,
        color: GREEN,
        maxChars: 42,
        maxLines: 2,
      },
      headline: {
        x: 85.6,
        y: 579.6,
        width: 590,
        height: 278.5,
        fontFamily: "Apex Fraunces",
        fontSize: 87.2,
        fontWeight: 700,
        lineHeight: 1.03,
        color: GREEN,
        maxChars: 58,
        maxLines: 3,
      },
      body: {
        x: 85.6,
        y: 922.3,
        width: 490,
        height: 372,
        fontFamily: "Apex Nourd",
        fontSize: 42.8,
        fontWeight: 400,
        lineHeight: 1.2,
        color: FLYER_GREEN,
        maxChars: 210,
        maxLines: 7,
      },
    },
  },
};

type ContractOverrides = Partial<
  Pick<TextContract, "x" | "y" | "width" | "height" | "fontSize" | "lineHeight">
>;

type DensityOverrides = Partial<
  Record<keyof FormatContract["fields"], ContractOverrides>
>;

/**
 * These are locked, designer-approved arrangements. Copy can select an
 * arrangement, but it can never freely move or resize an element.
 */
const ADAPTIVE_OVERRIDES: Record<
  Format,
  Record<ApexLayoutDensity, DensityOverrides>
> = {
  square: {
    short: {
      headline: { y: 394, height: 190, fontSize: 61.5, lineHeight: 0.96 },
      body: { y: 616, height: 92, fontSize: 28, lineHeight: 1.18 },
      cta: { y: 752 },
    },
    standard: {},
    long: {
      headline: { y: 357, height: 255, fontSize: 54, lineHeight: 0.98 },
      body: { y: 632, height: 116, fontSize: 25.2, lineHeight: 1.18 },
      cta: { y: 786 },
    },
  },
  story: {
    short: {
      headline: { y: 642, height: 292, fontSize: 75, lineHeight: 0.98 },
      body: { y: 980, height: 138, fontSize: 39, lineHeight: 1.16 },
      cta: { y: 1172 },
    },
    standard: {},
    long: {
      headline: { y: 585, height: 382, fontSize: 64, lineHeight: 1 },
      body: { y: 1014, height: 176, fontSize: 34, lineHeight: 1.18 },
      cta: { y: 1225 },
    },
  },
  flyer: {
    short: {
      headline: { y: 608, height: 224, fontSize: 92, lineHeight: 1.01 },
      body: { y: 884, height: 290, fontSize: 46, lineHeight: 1.18 },
    },
    standard: {},
    long: {
      headline: { y: 560, height: 330, fontSize: 72, lineHeight: 1.03 },
      body: { y: 886, height: 410, fontSize: 37.5, lineHeight: 1.2 },
    },
  },
};

function formatForSize(sizeKey?: SizeKey): Format {
  if (sizeKey === "story") return "story";
  if (sizeKey === "a4") return "flyer";
  return "square";
}

function assetUrl(
  origin: string,
  format: Format,
  mode: "reference" | "background"
) {
  const path = `/assets/apex-canine/apex-canine-${format}-${mode}.jpg`;
  return origin ? new URL(path, origin).toString() : path;
}

function supportCopy(fields: Fields) {
  return (
    fields.supportCopy ||
    fields.supportingCopy ||
    fields.subline ||
    fields.subheadline ||
    fields.body ||
    ""
  );
}

function copyLength(value: string) {
  return value.replace(/\s+/g, " ").trim().length;
}

function explicitLineCount(value: string) {
  return value ? value.split(/\r?\n/).length : 0;
}

function glyphUnits(value: string) {
  return Array.from(value).reduce((total, character) => {
    if (character === " ") return total + 0.31;
    if (/[ilI1.,'|]/.test(character)) return total + 0.3;
    if (/[mwMW@%&]/.test(character)) return total + 0.84;
    if (/[A-Z]/.test(character)) return total + 0.64;
    return total + 0.53;
  }, 0);
}

export function apexCanineLayoutDensity(
  sizeKey: SizeKey | undefined,
  fields: Fields
): ApexLayoutDensity {
  const format = formatForSize(sizeKey);
  const headline = fields.headline || "";
  const body =
    format === "flyer" ? fields.body || supportCopy(fields) : supportCopy(fields);
  const headlineRatio = copyLength(headline) / 58;
  const bodyRatio = copyLength(body) / (format === "flyer" ? 210 : 72);
  const density = Math.max(headlineRatio, bodyRatio);

  if (
    density >= 0.74 ||
    explicitLineCount(headline) >= 3 ||
    explicitLineCount(body) >= (format === "flyer" ? 5 : 3)
  ) {
    return "long";
  }
  if (
    density <= 0.5 &&
    copyLength(headline) <= 29 &&
    copyLength(body) <= (format === "flyer" ? 100 : 38) &&
    explicitLineCount(headline) <= 2 &&
    explicitLineCount(body) <= 2
  ) {
    return "short";
  }
  return "standard";
}

function contractForDensity(
  format: Format,
  density: ApexLayoutDensity
): FormatContract {
  const base = CONTRACTS[format];
  const overrides = ADAPTIVE_OVERRIDES[format][density];
  return {
    ...base,
    fields: {
      kicker: { ...base.fields.kicker, ...overrides.kicker },
      headline: { ...base.fields.headline, ...overrides.headline },
      body: { ...base.fields.body, ...overrides.body },
      ...(base.fields.cta
        ? { cta: { ...base.fields.cta, ...overrides.cta } }
        : {}),
    },
  };
}

function absoluteText(
  field: string,
  value: string,
  contract: TextContract
) {
  const fitted = fitCopy(value, {
    maxChars: contract.maxChars,
    maxLines: contract.maxLines,
  });

  return (
    <div
      data-template-field={field}
      style={{
        position: "absolute",
        display: "flex",
        flexWrap: "wrap",
        alignContent: "flex-start",
        left: contract.x,
        top: contract.y,
        width: contract.width,
        height: contract.height,
        overflow: "hidden",
        color: contract.color,
        fontFamily: contract.fontFamily,
        fontSize: contract.fontSize,
        fontWeight: contract.fontWeight,
        lineHeight: contract.lineHeight,
        whiteSpace: "pre-wrap",
      }}
    >
      <span
        data-template-content
        style={{
          display: "block",
          width: "100%",
        }}
      >
        {fitted}
      </span>
    </div>
  );
}

function flowText(field: string, value: string, contract: TextContract) {
  const fitted = fitCopy(value, {
    maxChars: contract.maxChars,
    maxLines: contract.maxLines,
  });

  return (
    <div
      data-template-field={field}
      style={{
        position: "relative",
        display: "flex",
        flexShrink: 0,
        width: contract.width,
        maxHeight: contract.height,
        overflow: "hidden",
        color: contract.color,
        fontFamily: contract.fontFamily,
        fontSize: contract.fontSize,
        fontWeight: contract.fontWeight,
        lineHeight: contract.lineHeight,
        whiteSpace: "pre-wrap",
      }}
    >
      <span data-template-content style={{ display: "block", width: "100%" }}>
        {fitted}
      </span>
    </div>
  );
}

function ctaButton(
  field: string,
  value: string,
  contract: TextContract,
  format: Format,
  flowOffset?: number
) {
  const horizontalPadding = format === "story" ? 22 : 21;
  const verticalPadding = format === "story" ? 12 : 11;
  const minWidth = format === "story" ? 250 : 170;
  const maxWidth = contract.width + horizontalPadding * 2;
  const fitted = fitCopy(value, { maxChars: contract.maxChars, maxLines: 1 });
  const measuredWidth =
    glyphUnits(fitted) * contract.fontSize * 1.08 + horizontalPadding * 2;
  const buttonWidth = Math.min(maxWidth, Math.max(minWidth, measuredWidth));

  return (
    <div
      data-template-field={field}
      style={{
        position: flowOffset === undefined ? "absolute" : "relative",
        display: "flex",
        flexShrink: 0,
        alignItems: "center",
        left:
          flowOffset === undefined
            ? contract.x - horizontalPadding
            : Math.max(0, flowOffset - horizontalPadding),
        top: flowOffset === undefined ? contract.y - verticalPadding : 0,
        width: buttonWidth,
        height: contract.height + verticalPadding * 2,
        paddingLeft: horizontalPadding,
        paddingRight: horizontalPadding,
        boxSizing: "border-box",
        overflow: "hidden",
        borderRadius: format === "story" ? 8 : 6,
        color: contract.color,
        backgroundColor: ORANGE,
        fontFamily: contract.fontFamily,
        fontSize: contract.fontSize,
        fontWeight: contract.fontWeight,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      <span data-template-content style={{ display: "block" }}>
        {fitted}
      </span>
    </div>
  );
}

function ApexCanvas({
  contract,
  fields,
  origin,
  original,
  density,
}: {
  contract: FormatContract;
  fields: Fields;
  origin: string;
  original?: boolean;
  density: ApexLayoutDensity;
}) {
  const stack =
    contract.format === "square"
      ? { headlineBodyGap: 34, bodyCtaGap: 34, maxHeight: 490 }
      : contract.format === "story"
        ? { headlineBodyGap: 52, bodyCtaGap: 48, maxHeight: 690 }
        : { headlineBodyGap: 46, bodyCtaGap: 0, maxHeight: 740 };

  return (
    <div
      data-apex-format={contract.format}
      data-apex-density={density}
      style={{
        position: "relative",
        display: "flex",
        width: contract.width,
        height: contract.height,
        overflow: "hidden",
        backgroundImage: `url(${assetUrl(
          origin,
          contract.format,
          original ? "reference" : "background"
        )})`,
        backgroundSize: `${contract.width}px ${contract.height}px`,
        backgroundRepeat: "no-repeat",
      }}
    >
      {!original && (
        <>
          {absoluteText(
            "kicker",
            fields.kicker || fields.subheadline || "",
            contract.fields.kicker
          )}
          <div
            data-template-stack
            style={{
              position: "absolute",
              display: "flex",
              flexDirection: "column",
              left: contract.fields.headline.x,
              top: contract.fields.headline.y,
              width: contract.fields.headline.width,
              maxHeight: stack.maxHeight,
              overflow: "hidden",
            }}
          >
            {flowText(
              "headline",
              fields.headline || "",
              contract.fields.headline
            )}
            <div
              aria-hidden="true"
              style={{
                display: "flex",
                flexShrink: 0,
                height: stack.headlineBodyGap,
              }}
            />
            {flowText(
              contract.format === "flyer" ? "body" : "supportCopy",
              contract.format === "flyer"
                ? fields.body || supportCopy(fields)
                : supportCopy(fields),
              contract.fields.body
            )}
            {contract.fields.cta && (
              <>
                <div
                  aria-hidden="true"
                  style={{
                    display: "flex",
                    flexShrink: 0,
                    height: stack.bodyCtaGap,
                  }}
                />
                {ctaButton(
                  "cta",
                  fields.cta || "",
                  contract.fields.cta,
                  contract.format,
                  contract.fields.cta.x - contract.fields.headline.x
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function apexCanineDimensions(sizeKey?: SizeKey) {
  const contract = CONTRACTS[formatForSize(sizeKey)];
  return { w: contract.width, h: contract.height };
}

export function isApexCanineSizeAllowed(
  layoutKey: string,
  sizeKey: SizeKey
): boolean {
  return layoutKey === "apex_canine_flyer"
    ? sizeKey === "a4"
    : sizeKey === "square" || sizeKey === "story";
}

export function renderApexCanine(input: RenderInput): RenderResult {
  const format = formatForSize(input.sizeKey);
  const density = apexCanineLayoutDensity(input.sizeKey, input.fields);
  const contract = contractForDensity(format, density);
  return {
    element: (
      <ApexCanvas
        contract={contract}
        fields={input.fields}
        origin={input.origin}
        original={input.original}
        density={density}
      />
    ),
    w: contract.width,
    h: contract.height,
    density,
  };
}
