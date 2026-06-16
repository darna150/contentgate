import React from "react";
import type { SizeKey } from "./creative";
import { fitCopy, pickCopy, type CopyFit } from "./render-copy";

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
};

const C = {
  teal: "#1A4A3A",
  green: "#3A7A5A",
  dark: "#1A2C1A",
  body: "#2E2E2E",
  white: "#FFFFFF",
};

function assetUrl(
  origin: string,
  format: "square" | "story" | "feed" | "flyer",
  mode: "reference" | "background"
) {
  return new URL(
    `/assets/vitalbite/vitalbite-${format}-${mode}.png`,
    origin
  ).toString();
}

function Spacer({ height }: { height: number }) {
  return <div style={{ display: "flex", flexShrink: 0, height }} />;
}

function supportingCopy(fields: Fields, fit?: CopyFit) {
  return fitCopy(
    pickCopy(fields, ["supporting", "supportCopy", "supportingCopy", "subline", "subheadline", "body"]),
    fit
  );
}

function Text({
  value,
  marginLeft,
  width,
  height,
  color = C.dark,
  size,
  weight,
  lineHeight,
  align = "left",
}: {
  value?: string;
  marginLeft: number;
  width: number;
  height: number;
  color?: string;
  size: number;
  weight: 400 | 500 | 600 | 700 | 800;
  lineHeight: number;
  align?: "left" | "center";
}) {
  return (
    <div
      style={{
        display: "flex",
        flexShrink: 0,
        width,
        height,
        marginLeft,
        overflow: "hidden",
        color,
        fontFamily: "Nunito Sans",
        fontSize: size,
        fontWeight: weight,
        lineHeight,
        textAlign: align,
        whiteSpace: "pre-wrap",
      }}
    >
      {value}
    </div>
  );
}

function Kicker({
  value,
  marginLeft,
  width,
  height,
  size,
}: {
  value?: string;
  marginLeft: number;
  width: number;
  height: number;
  size: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        width,
        height,
        marginLeft,
        overflow: "hidden",
        color: C.green,
        fontFamily: "Nunito Sans",
        fontSize: size,
        fontWeight: 500,
        lineHeight: 1.1,
        whiteSpace: "pre-wrap",
      }}
    >
      {value}
    </div>
  );
}

function Button({
  value,
  marginLeft,
  width,
  height,
  size,
}: {
  value?: string;
  marginLeft: number;
  width: number;
  height: number;
  size: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width,
        height,
        marginLeft,
        borderRadius: height / 2,
        backgroundColor: C.teal,
        color: C.white,
        fontFamily: "Nunito Sans",
        fontSize: size,
        fontWeight: 700,
        overflow: "hidden",
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </div>
  );
}

function Canvas({
  width,
  height,
  format,
  origin,
  original,
  children,
}: {
  width: number;
  height: number;
  format: "square" | "story" | "feed" | "flyer";
  origin: string;
  original?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        height,
        overflow: "hidden",
        backgroundImage: `url(${assetUrl(
          origin,
          format,
          original ? "reference" : "background"
        )})`,
        backgroundSize: `${width}px ${height}px`,
        backgroundRepeat: "no-repeat",
      }}
    >
      {!original && children}
    </div>
  );
}

function Square({ fields, origin, original }: Omit<RenderInput, "sizeKey" | "layoutKey">) {
  return (
    <Canvas width={1080} height={1080} format="square" origin={origin} original={original}>
      <Spacer height={212} />
      <Kicker value={fitCopy(fields.kicker, { maxChars: 30 })} marginLeft={52} width={460} height={50} size={28} />
      <Spacer height={14} />
      <Text
        value={fitCopy(fields.headline, { maxChars: 28, maxLines: 3, lineChars: 9 })}
        marginLeft={52}
        width={490}
        height={268}
        size={86}
        weight={800}
        lineHeight={1.02}
      />
      <Spacer height={16} />
      <Text
        value={supportingCopy(fields, { maxChars: 82, maxWords: 11, maxLines: 2, lineChars: 32 })}
        marginLeft={52}
        width={448}
        height={60}
        color={C.body}
        size={26}
        weight={400}
        lineHeight={1.3}
      />
      <Spacer height={18} />
      <Button value={fitCopy(fields.cta, { maxChars: 14 })} marginLeft={52} width={255} height={66} size={27} />
    </Canvas>
  );
}

function Story({ fields, origin, original }: Omit<RenderInput, "sizeKey" | "layoutKey">) {
  return (
    <Canvas width={1080} height={1920} format="story" origin={origin} original={original}>
      <Spacer height={722} />
      <Kicker value={fitCopy(fields.kicker, { maxChars: 34 })} marginLeft={54} width={580} height={52} size={30} />
      <Spacer height={16} />
      <Text
        value={fitCopy(fields.headline, { maxChars: 36, maxLines: 3, lineChars: 12 })}
        marginLeft={54}
        width={700}
        height={310}
        size={92}
        weight={800}
        lineHeight={1.01}
      />
      <Spacer height={20} />
      <Text
        value={supportingCopy(fields, { maxChars: 90, maxWords: 12, maxLines: 2, lineChars: 34 })}
        marginLeft={54}
        width={610}
        height={66}
        color={C.body}
        size={30}
        weight={400}
        lineHeight={1.3}
      />
      <Spacer height={24} />
      <Text
        value={fitCopy(pickCopy(fields, ["bullets", "benefits"]), { maxChars: 140, maxLines: 4, lineChars: 34 })}
        marginLeft={54}
        width={640}
        height={196}
        size={30}
        weight={500}
        lineHeight={1.38}
      />
      <Spacer height={28} />
      <Button value={fitCopy(fields.cta, { maxChars: 15 })} marginLeft={54} width={295} height={78} size={30} />
    </Canvas>
  );
}

function Feed({ fields, origin, original }: Omit<RenderInput, "sizeKey" | "layoutKey">) {
  return (
    <Canvas width={1200} height={630} format="feed" origin={origin} original={original}>
      {/* Positions measured against vitalbite-feed-reference.png: logo
          bottom ~95, headline top ~180, support top ~440, CTA top ~520. */}
      <Spacer height={180} />
      <Text
        value={fitCopy(fields.headline, { maxChars: 30, maxLines: 3, lineChars: 10 })}
        marginLeft={54}
        width={520}
        height={235}
        size={78}
        weight={800}
        lineHeight={1.01}
      />
      <Spacer height={30} />
      <Text
        value={supportingCopy(fields, { maxChars: 76, maxWords: 10, maxLines: 2, lineChars: 32 })}
        marginLeft={54}
        width={498}
        height={50}
        color={C.body}
        size={26}
        weight={400}
        lineHeight={1.3}
      />
      <Spacer height={30} />
      <Button value={fitCopy(fields.cta, { maxChars: 14 })} marginLeft={54} width={240} height={62} size={26} />
    </Canvas>
  );
}

function Flyer({ fields, disclaimer, origin, original }: Omit<RenderInput, "sizeKey" | "layoutKey">) {
  // Each benefit must be fit independently (own maxLines budget) — fitting
  // the joined string with a single maxLines cap starves later items of
  // lines and silently drops them.
  const benefitItems = (fields.benefits ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
  const benefitLines = benefitItems.map((item) => fitCopy(item, { maxChars: 40, maxLines: 2, lineChars: 20 }));

  return (
    <Canvas width={1240} height={1754} format="flyer" origin={origin} original={original}>
      {/* Positions measured against vitalbite-flyer-reference.png: kicker
          top ~325, headline top ~390, body top ~715, the three benefit
          rows at ~1050/1150/1255, CTA top ~1370, website top ~1455. */}
      <Spacer height={325} />
      <Kicker value={fitCopy(fields.kicker, { maxChars: 32 })} marginLeft={78} width={500} height={40} size={28} />
      <Spacer height={30} />
      {/* No lineChars rewrap here: the headline is authored as 3 short
          newline-separated phrases (see default_copy), each meant to occupy
          one line. Re-wrapping by an approximate char budget at this font
          size mis-measures bold glyph width and drops the last phrase. */}
      <Text
        value={fitCopy(fields.headline, { maxChars: 60, maxLines: 3 })}
        marginLeft={78}
        width={560}
        height={240}
        size={58}
        weight={800}
        lineHeight={1.35}
      />
      <Spacer height={80} />
      <Text
        value={fitCopy(fields.body || supportingCopy(fields), { maxChars: 220, maxWords: 36, maxLines: 6, lineChars: 32 })}
        marginLeft={78}
        width={370}
        height={325}
        color={C.body}
        size={23}
        weight={400}
        lineHeight={1.42}
      />
      <Spacer height={10} />
      <Text value={benefitLines[0] ?? ""} marginLeft={165} width={300} height={60} size={22} weight={700} lineHeight={1.22} />
      <Spacer height={40} />
      <Text value={benefitLines[1] ?? ""} marginLeft={165} width={300} height={60} size={22} weight={700} lineHeight={1.22} />
      <Spacer height={45} />
      <Text value={benefitLines[2] ?? ""} marginLeft={165} width={300} height={60} size={22} weight={700} lineHeight={1.22} />
      <Spacer height={55} />
      <Button value={fitCopy(fields.cta, { maxChars: 20 })} marginLeft={76} width={344} height={60} size={26} />
      <Spacer height={25} />
      <Text
        value={fitCopy(pickCopy(fields, ["website", "contact"]), { maxChars: 28 })}
        marginLeft={76}
        width={330}
        height={30}
        color={C.teal}
        size={26}
        weight={500}
        lineHeight={1.1}
      />
      <Spacer height={50} />
      <Text
        value={fitCopy(disclaimer, { maxChars: 160, maxLines: 3, lineChars: 46 })}
        marginLeft={78}
        width={400}
        height={94}
        color="#5A5A5A"
        size={18}
        weight={400}
        lineHeight={1.32}
      />
    </Canvas>
  );
}

function resolveFormat(layoutKey?: string, sizeKey?: SizeKey): "square" | "story" | "feed" | "flyer" {
  if (layoutKey === "vitalbite_flyer") return "flyer";
  if (sizeKey === "story" || layoutKey === "vitalbite_story") return "story";
  if (sizeKey === "feed" || layoutKey === "vitalbite_feed") return "feed";
  return "square";
}

export function renderVitalBite(input: RenderInput): RenderResult {
  const format = resolveFormat(input.layoutKey, input.sizeKey);
  switch (format) {
    case "story":
      return { element: <Story {...input} />, w: 1080, h: 1920 };
    case "feed":
      return { element: <Feed {...input} />, w: 1200, h: 630 };
    case "flyer":
      return { element: <Flyer {...input} />, w: 1240, h: 1754 };
    default:
      return { element: <Square {...input} />, w: 1080, h: 1080 };
  }
}
