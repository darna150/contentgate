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
  crimson: "#C0272D",
  muted: "#444444",
  dim: "#888888",
  white: "#FFFFFF",
};

function assetUrl(
  origin: string,
  format: "square" | "story" | "feed" | "flyer",
  mode: "reference" | "background"
) {
  return new URL(
    `/assets/swineguardplus/swineguardplus-${format}-${mode}.png`,
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

// All headline lines are crimson — no colour split
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
        <div key={`${line}-${i}`} style={{ display: "flex", flexShrink: 0, color: C.crimson }}>
          {line}
        </div>
      ))}
    </div>
  );
}

// "» " bold prefix + regular-weight kicker text, both crimson
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
        alignItems: "center",
        marginLeft,
        width,
        height,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          color: C.crimson,
          fontFamily: "Roboto",
          fontWeight: 700,
          fontSize: size,
        }}
      >
        &gt;&nbsp;
      </div>
      <div
        style={{
          display: "flex",
          color: C.crimson,
          fontFamily: "Roboto",
          fontWeight: 400,
          fontSize: size,
          overflow: "hidden",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TextBox({
  value,
  marginLeft,
  width,
  height,
  color = C.muted,
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

// Filled crimson circle with white marker followed by crimson CTA text
function SocialCta({
  cta,
  marginLeft,
  circleSize,
  fontSize,
}: {
  cta?: string;
  marginLeft: number;
  circleSize: number;
  fontSize: number;
}) {
  return (
    <div style={{ display: "flex", flexShrink: 0, alignItems: "center", marginLeft }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          backgroundColor: C.crimson,
        }}
      >
        <div
          style={{
            display: "flex",
            color: C.white,
            fontFamily: "Roboto",
            fontWeight: 800,
            fontSize: Math.round(circleSize * 0.48),
          }}
        >
          &gt;
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          marginLeft: 14,
          color: C.crimson,
          fontFamily: "Roboto",
          fontWeight: 700,
          fontSize,
        }}
      >
        {cta}
      </div>
    </div>
  );
}

// Flyer CTA: marker glyph + large bold multi-line cta text
function FlyerCta({
  cta,
  marginLeft,
  width,
}: {
  cta?: string;
  marginLeft: number;
  width: number;
}) {
  return (
    <div style={{ display: "flex", flexShrink: 0, alignItems: "flex-start", marginLeft, width }}>
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          color: C.crimson,
          fontFamily: "Roboto",
          fontWeight: 800,
          fontSize: 48,
          lineHeight: 1.1,
          marginRight: 14,
          marginTop: 4,
        }}
      >
        &gt;
      </div>
      <div
        style={{
          display: "flex",
          color: C.crimson,
          fontFamily: "Roboto",
          fontWeight: 800,
          fontSize: 42,
          lineHeight: 1.12,
          whiteSpace: "pre-wrap",
          overflow: "hidden",
        }}
      >
        {fitCopy(cta, { maxChars: 28, maxLines: 2, lineChars: 18 })}
      </div>
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
      <Spacer height={258} />
      <Kicker value={fitCopy(fields.kicker, { maxChars: 40 })} marginLeft={54} width={500} height={30} size={21} />
      <Spacer height={10} />
      <Headline value={fitCopy(fields.headline, { maxChars: 42, maxLines: 3, lineChars: 16 })} marginLeft={54} width={520} height={220} size={62} lineHeight={1.06} />
      <Spacer height={12} />
      <TextBox value={supportingCopy(fields, { maxChars: 70, maxWords: 9, maxLines: 2, lineChars: 32 })} marginLeft={54} width={448} height={60} size={22} weight={400} lineHeight={1.32} />
      <Spacer height={275} />
      <SocialCta cta={fitCopy(fields.cta, { maxChars: 24 })} marginLeft={54} circleSize={52} fontSize={26} />
    </Canvas>
  );
}

function Story({ fields, origin, original }: Omit<RenderInput, "sizeKey">) {
  return (
    <Canvas width={1080} height={1920} format="story" origin={origin} original={original}>
      <Spacer height={307} />
      <Kicker value={fitCopy(fields.kicker, { maxChars: 40 })} marginLeft={54} width={560} height={34} size={24} />
      <Spacer height={12} />
      <Headline value={fitCopy(fields.headline, { maxChars: 42, maxLines: 3, lineChars: 17 })} marginLeft={54} width={630} height={255} size={76} lineHeight={1.07} />
      <Spacer height={18} />
      <TextBox value={supportingCopy(fields, { maxChars: 80, maxWords: 10, maxLines: 2, lineChars: 34 })} marginLeft={54} width={520} height={74} size={25} weight={400} lineHeight={1.35} />
      <Spacer height={945} />
      <SocialCta cta={fitCopy(fields.cta, { maxChars: 24 })} marginLeft={54} circleSize={60} fontSize={28} />
    </Canvas>
  );
}

function Feed({ fields, origin, original }: Omit<RenderInput, "sizeKey">) {
  return (
    <Canvas width={1200} height={630} format="feed" origin={origin} original={original}>
      <Spacer height={118} />
      <Headline value={fitCopy(fields.headline, { maxChars: 42, maxLines: 3, lineChars: 20 })} marginLeft={54} width={530} height={152} size={46} lineHeight={1.05} />
      <Spacer height={14} />
      <TextBox value={supportingCopy(fields, { maxChars: 68, maxWords: 9, maxLines: 2, lineChars: 34 })} marginLeft={54} width={480} height={54} size={20} weight={400} lineHeight={1.3} />
      <Spacer height={22} />
      <SocialCta cta={fitCopy(fields.cta, { maxChars: 24 })} marginLeft={54} circleSize={46} fontSize={22} />
    </Canvas>
  );
}

function Flyer({ fields, disclaimer, origin, original }: Omit<RenderInput, "sizeKey">) {
  const body = fields.body || fields.supporting || "";
  return (
    <Canvas width={1240} height={1754} format="flyer" origin={origin} original={original}>
      <Spacer height={330} />
      <Kicker value={fitCopy(fields.kicker, { maxChars: 40 })} marginLeft={58} width={560} height={30} size={22} />
      <Spacer height={8} />
      <Headline value={fitCopy(fields.headline, { maxChars: 46, maxLines: 3, lineChars: 18 })} marginLeft={58} width={620} height={205} size={60} lineHeight={1.07} />
      <Spacer height={16} />
      <TextBox value={fitCopy(body, { maxChars: 135, maxWords: 22, maxLines: 4, lineChars: 34 })} marginLeft={58} width={500} height={130} size={22} weight={400} lineHeight={1.35} />
      {/* Benefits — text sits beside the three circle icons baked into the background */}
      <Spacer height={116} />
      <TextBox value={fitCopy(fields.benefit_1, { maxChars: 32, maxLines: 2, lineChars: 22 })} marginLeft={270} width={350} height={50} size={20} weight={700} lineHeight={1.2} color={C.muted} />
      <Spacer height={92} />
      <TextBox value={fitCopy(fields.benefit_2, { maxChars: 32, maxLines: 2, lineChars: 22 })} marginLeft={270} width={350} height={50} size={20} weight={700} lineHeight={1.2} color={C.muted} />
      <Spacer height={92} />
      <TextBox value={fitCopy(fields.benefit_3, { maxChars: 32, maxLines: 2, lineChars: 22 })} marginLeft={270} width={350} height={50} size={20} weight={700} lineHeight={1.2} color={C.muted} />
      <Spacer height={74} />
      <FlyerCta cta={fields.cta} marginLeft={58} width={520} />
      <Spacer height={20} />
      <TextBox value={fitCopy(fields.contact, { maxChars: 28 })} marginLeft={58} width={340} height={40} size={22} weight={500} lineHeight={1} color={C.muted} />
      <Spacer height={298} />
      <TextBox value={disclaimer} marginLeft={58} width={860} height={50} size={17} weight={400} lineHeight={1.3} color={C.dim} />
    </Canvas>
  );
}

export function renderSwineGuardPlus(input: RenderInput): RenderResult {
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
