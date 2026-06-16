import React from "react";
import type { SizeKey } from "./creative";
import { fitCopy, pickCopy, type CopyFit } from "./render-copy";

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
};

const C = {
  amber: "#E89010",
  white: "#FFFFFF",
  dim: "#C8C0B0",
};

function assetUrl(
  origin: string,
  format: "square" | "story" | "feed" | "flyer",
  mode: "reference" | "background"
) {
  return new URL(
    `/assets/poultryshieldpro/poultryshieldpro-${format}-${mode}.png`,
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

// Line 0 = white; lines 1+ = amber
function Headline({
  value,
  marginLeft,
  width,
  height,
  size,
  lineHeight,
}: {
  value?: string;
  marginLeft: number;
  width: number;
  height: number;
  size: number;
  lineHeight: number;
}) {
  const lines = (value ?? "").split(/\r?\n/);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        width,
        height,
        marginLeft,
        overflow: "hidden",
        fontFamily: "Roboto",
        fontSize: size,
        fontWeight: 800,
        lineHeight,
        letterSpacing: "-0.02em",
      }}
    >
      {lines.map((line, i) => (
        <div
          key={`${line}-${i}`}
          style={{ display: "flex", flexShrink: 0, color: i === 0 ? C.white : C.amber }}
        >
          {line}
        </div>
      ))}
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
        flexShrink: 0,
        width,
        height,
        marginLeft,
        overflow: "hidden",
        color: C.amber,
        fontFamily: "Roboto",
        fontSize: size,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {value}
    </div>
  );
}

function TextBox({
  value,
  marginLeft,
  width,
  height,
  color = C.white,
  size,
  weight,
  lineHeight,
}: {
  value?: string;
  marginLeft: number;
  width: number;
  height: number;
  color?: string;
  size: number;
  weight: 400 | 500 | 600 | 700 | 800;
  lineHeight: number;
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
        fontFamily: "Roboto",
        fontSize: size,
        fontWeight: weight,
        lineHeight,
        whiteSpace: "pre-wrap",
      }}
    >
      {value}
    </div>
  );
}

// "Discover " in white, rest in amber, trailing ›
function CtaLine({
  cta,
  marginLeft,
  size,
  width = 620,
  height = 44,
}: {
  cta?: string;
  marginLeft: number;
  size: number;
  width?: number;
  height?: number;
}) {
  const text = fitCopy(cta ?? "Discover PoultryShield Pro", { maxChars: 28 });
  const spaceIdx = text.indexOf(" ");
  const first = spaceIdx >= 0 ? text.slice(0, spaceIdx) : text;
  const rest = spaceIdx >= 0 ? text.slice(spaceIdx + 1) : "";
  return (
    <div
      style={{
        display: "flex",
        flexShrink: 0,
        alignItems: "center",
        width,
        height,
        marginLeft,
        overflow: "hidden",
        fontFamily: "Roboto",
        fontWeight: 700,
        fontSize: size,
      }}
    >
      <div style={{ display: "flex", color: C.white }}>{first}&nbsp;</div>
      <div style={{ display: "flex", color: C.amber }}>{rest}&nbsp;&gt;</div>
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
        backgroundImage: `url(${assetUrl(origin, format, original ? "reference" : "background")})`,
        backgroundSize: `${width}px ${height}px`,
        backgroundRepeat: "no-repeat",
      }}
    >
      {!original && children}
    </div>
  );
}

function Square({ fields, origin, original }: Omit<RenderInput, "sizeKey">) {
  return (
    <Canvas width={1080} height={1080} format="square" origin={origin} original={original}>
      <Spacer height={265} />
      <Kicker value={fitCopy(fields.kicker, { maxChars: 40 })} marginLeft={54} width={520} height={32} size={23} />
      <Spacer height={8} />
      <Headline value={fitCopy(fields.headline, { maxChars: 42, maxLines: 3, lineChars: 16 })} marginLeft={54} width={535} height={220} size={62} lineHeight={1.05} />
      <Spacer height={16} />
      <TextBox value={supportingCopy(fields, { maxChars: 72, maxWords: 9, maxLines: 2, lineChars: 28 })} marginLeft={54} width={430} height={68} size={25} weight={400} lineHeight={1.32} />
      <Spacer height={185} />
      {/* CTA sits over the dark strip baked into the background */}
      <CtaLine cta={fields.cta} marginLeft={162} size={30} width={500} height={46} />
    </Canvas>
  );
}

function Story({ fields, origin, original }: Omit<RenderInput, "sizeKey">) {
  return (
    <Canvas width={1080} height={1920} format="story" origin={origin} original={original}>
      <Spacer height={442} />
      <Kicker value={fitCopy(fields.kicker, { maxChars: 40 })} marginLeft={58} width={560} height={34} size={25} />
      <Spacer height={12} />
      <Headline value={fitCopy(fields.headline, { maxChars: 42, maxLines: 3, lineChars: 17 })} marginLeft={58} width={650} height={255} size={76} lineHeight={1.06} />
      <Spacer height={18} />
      <TextBox value={supportingCopy(fields, { maxChars: 80, maxWords: 10, maxLines: 2, lineChars: 32 })} marginLeft={58} width={520} height={80} size={27} weight={400} lineHeight={1.35} />
      <Spacer height={789} />
      {/* CTA sits over the dark strip baked into the background */}
      <CtaLine cta={fields.cta} marginLeft={168} size={36} width={600} height={54} />
    </Canvas>
  );
}

function Feed({ fields, origin, original }: Omit<RenderInput, "sizeKey">) {
  return (
    <Canvas width={1200} height={630} format="feed" origin={origin} original={original}>
      <Spacer height={125} />
      <Headline value={fitCopy(fields.headline, { maxChars: 42, maxLines: 3, lineChars: 20 })} marginLeft={54} width={540} height={152} size={46} lineHeight={1.04} />
      <Spacer height={14} />
      <TextBox value={supportingCopy(fields, { maxChars: 70, maxWords: 9, maxLines: 2, lineChars: 34 })} marginLeft={54} width={490} height={58} size={21} weight={400} lineHeight={1.3} />
      <Spacer height={20} />
      <CtaLine cta={fields.cta} marginLeft={54} size={26} width={460} height={40} />
    </Canvas>
  );
}

function Flyer({ fields, disclaimer, origin, original }: Omit<RenderInput, "sizeKey">) {
  const body = fields.body || fields.supporting || "";
  return (
    <Canvas width={1240} height={1754} format="flyer" origin={origin} original={original}>
      <Spacer height={362} />
      <Kicker value={fitCopy(fields.kicker, { maxChars: 40 })} marginLeft={62} width={580} height={34} size={26} />
      <Spacer height={12} />
      <Headline value={fitCopy(fields.headline, { maxChars: 46, maxLines: 3, lineChars: 18 })} marginLeft={62} width={620} height={210} size={62} lineHeight={1.06} />
      <Spacer height={18} />
      <TextBox value={fitCopy(body, { maxChars: 135, maxWords: 22, maxLines: 4, lineChars: 32 })} marginLeft={62} width={500} height={135} size={24} weight={400} lineHeight={1.35} />
      <Spacer height={18} />
      <TextBox value={fitCopy(fields.benefit_1, { maxChars: 32, maxLines: 2, lineChars: 22 })} marginLeft={160} width={430} height={50} size={22} weight={700} lineHeight={1.2} />
      <Spacer height={10} />
      <TextBox value={fitCopy(fields.benefit_2, { maxChars: 32, maxLines: 2, lineChars: 22 })} marginLeft={160} width={430} height={50} size={22} weight={700} lineHeight={1.2} />
      <Spacer height={10} />
      <TextBox value={fitCopy(fields.benefit_3, { maxChars: 32, maxLines: 2, lineChars: 22 })} marginLeft={160} width={430} height={50} size={22} weight={700} lineHeight={1.2} />
      <Spacer height={97} />
      {/* CTA row with website on the right — both sit over the dark strip */}
      <div style={{ display: "flex", flexShrink: 0, alignItems: "center", width: 1240, height: 90 }}>
        <CtaLine cta={fields.cta} marginLeft={162} size={32} width={460} height={46} />
      </div>
      <Spacer height={512} />
      <TextBox
        value={disclaimer}
        marginLeft={200}
        width={860}
        height={56}
        color={C.dim}
        size={18}
        weight={400}
        lineHeight={1.3}
      />
    </Canvas>
  );
}

export function renderPoultryShieldPro(input: RenderInput): RenderResult {
  if (input.sizeKey === "story") {
    return { element: <Story {...input} />, w: 1080, h: 1920 };
  }
  if (input.sizeKey === "feed") {
    return { element: <Feed {...input} />, w: 1200, h: 630 };
  }
  if (input.sizeKey === "a4") {
    return { element: <Flyer {...input} />, w: 1240, h: 1754 };
  }
  return { element: <Square {...input} />, w: 1080, h: 1080 };
}
