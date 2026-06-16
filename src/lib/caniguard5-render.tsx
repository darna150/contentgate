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
  navy: "#061D4C",
  blue: "#0667D8",
  lightBlue: "#78B8FF",
  white: "#FFFFFF",
  muted: "#1F2D44",
};

const DISEASES = [
  "DISTEMPER",
  "PARVOVIRUS",
  "ADENOVIRUS\nTYPE 2",
  "PARAINFLUENZA",
  "LEPTOSPIROSIS",
];

function assetUrl(
  origin: string,
  format: "square" | "story" | "feed" | "flyer",
  mode: "reference" | "background"
) {
  return new URL(
    `/assets/caniguard5/caniguard5-${format}-${mode}.png`,
    origin
  ).toString();
}

function supportingCopy(fields: Fields, fit?: CopyFit) {
  return fitCopy(
    pickCopy(fields, ["supportCopy", "supportingCopy", "supporting", "subline", "subheadline", "body"]),
    fit
  );
}

function Spacer({ height }: { height: number }) {
  return <div style={{ display: "flex", flexShrink: 0, height }} />;
}

function TextBox({
  value,
  marginLeft,
  width,
  height,
  color = C.navy,
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
  weight: 400 | 500 | 700 | 800;
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
        fontFamily: "Roboto",
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
        letterSpacing: "-0.04em",
      }}
    >
      {lines.map((line, index) => (
        <div
          key={`${line}-${index}`}
          style={{
            display: "flex",
            flexShrink: 0,
            color: index === lines.length - 1 ? C.blue : C.navy,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

function Rule({ marginLeft, width, height = 7 }: { marginLeft: number; width: number; height?: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexShrink: 0,
        width,
        height,
        marginLeft,
        borderRadius: height,
        backgroundColor: C.blue,
      }}
    />
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
        flexShrink: 0,
        width,
        height,
        marginLeft,
        paddingLeft: 34,
        paddingRight: 24,
        boxSizing: "border-box",
        borderRadius: 10,
        color: C.white,
        backgroundColor: C.navy,
        fontFamily: "Roboto",
        fontSize: size,
        fontWeight: 700,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex" }}>{value}</div>
      </div>
      <div style={{ display: "flex", color: C.blue, fontSize: size + 14, fontWeight: 700 }}>
        &gt;
      </div>
    </div>
  );
}

function FlyerCta({
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
        paddingLeft: 200,
        paddingRight: 44,
        boxSizing: "border-box",
        color: C.white,
        fontFamily: "Roboto",
        fontSize: size,
        fontWeight: 700,
      }}
    >
      <div style={{ display: "flex", flex: 1, overflow: "hidden", whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ display: "flex", color: C.blue, fontSize: size + 12, fontWeight: 800 }}>
        &gt;
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

function Square({ fields, origin, original }: Omit<RenderInput, "sizeKey">) {
  return (
    <Canvas width={1080} height={1080} format="square" origin={origin} original={original}>
      <Spacer height={192} />
      <TextBox
        value={fitCopy(fields.kicker, { maxChars: 34 })}
        marginLeft={174}
        width={470}
        height={34}
        color={C.blue}
        size={20}
        weight={700}
        lineHeight={1}
        align="center"
      />
      <Spacer height={46} />
      <Headline
        value={fitCopy(fields.headline, { maxChars: 50, maxLines: 3, lineChars: 18 })}
        marginLeft={54}
        width={540}
        height={235}
        size={72}
        lineHeight={1.02}
      />
      <Spacer height={24} />
      <Rule marginLeft={58} width={98} />
      <Spacer height={34} />
      <TextBox
        value={supportingCopy(fields, { maxChars: 104, maxWords: 14, maxLines: 3, lineChars: 32 })}
        marginLeft={58}
        width={475}
        height={118}
        color={C.muted}
        size={27}
        weight={400}
        lineHeight={1.35}
      />
      <Spacer height={92} />
      <Button value={fitCopy(fields.cta, { maxChars: 24 })} marginLeft={64} width={424} height={100} size={29} />
    </Canvas>
  );
}

function Story({ fields, origin, original }: Omit<RenderInput, "sizeKey">) {
  return (
    <Canvas width={1080} height={1920} format="story" origin={origin} original={original}>
      <Spacer height={318} />
      <TextBox
        value={fitCopy(fields.kicker, { maxChars: 34 })}
        marginLeft={220}
        width={520}
        height={38}
        color={C.blue}
        size={22}
        weight={700}
        lineHeight={1}
        align="center"
      />
      <Spacer height={70} />
      <Headline
        value={fitCopy(fields.headline, { maxChars: 50, maxLines: 3, lineChars: 20 })}
        marginLeft={74}
        width={760}
        height={292}
        size={78}
        lineHeight={1.05}
      />
      <Spacer height={28} />
      <Rule marginLeft={80} width={98} />
      <Spacer height={40} />
      <TextBox
        value={supportingCopy(fields, { maxChars: 104, maxWords: 14, maxLines: 3, lineChars: 32 })}
        marginLeft={78}
        width={500}
        height={136}
        color={C.muted}
        size={28}
        weight={400}
        lineHeight={1.42}
      />
      <Spacer height={44} />
      <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, marginLeft: 168, width: 210, height: 492 }}>
        {DISEASES.map((label, index) => (
          <TextBox
            key={label}
            value={label}
            marginLeft={0}
            width={210}
            height={index === 2 ? 92 : 78}
            color={C.blue}
            size={18}
            weight={800}
            lineHeight={1.08}
          />
        ))}
      </div>
      <Spacer height={106} />
      <Button value={fitCopy(fields.cta, { maxChars: 24 })} marginLeft={248} width={584} height={116} size={38} />
    </Canvas>
  );
}

function Feed({ fields, origin, original }: Omit<RenderInput, "sizeKey">) {
  return (
    <Canvas width={1200} height={630} format="feed" origin={origin} original={original}>
      <Spacer height={155} />
      <TextBox
        value={fitCopy(fields.kicker, { maxChars: 34 })}
        marginLeft={128}
        width={350}
        height={22}
        color={C.blue}
        size={18}
        weight={700}
        lineHeight={1}
        align="center"
      />
      <Spacer height={32} />
      <Headline
        value={fitCopy(fields.headline, { maxChars: 50, maxLines: 3, lineChars: 19 })}
        marginLeft={56}
        width={470}
        height={155}
        size={48}
        lineHeight={1.05}
      />
      <Spacer height={20} />
      <Rule marginLeft={60} width={64} height={6} />
      <Spacer height={18} />
      <TextBox
        value={supportingCopy(fields, { maxChars: 86, maxWords: 12, maxLines: 2, lineChars: 34 })}
        marginLeft={60}
        width={472}
        height={70}
        color={C.muted}
        size={22}
        weight={400}
        lineHeight={1.35}
      />
      <Spacer height={16} />
      <Button value={fitCopy(fields.cta, { maxChars: 24 })} marginLeft={58} width={350} height={62} size={25} />
      <Spacer height={18} />
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0, width: 1200, height: 50 }}>
        {/* contact's box must be wide enough for its own maxChars at this
            font size, or long values wrap to a 2nd line and collide with
            the tagline box below/beside it. */}
        <TextBox
          value={fitCopy(fields.contact, { maxChars: 18, maxLines: 1, lineChars: 18 })}
          marginLeft={64}
          width={220}
          height={28}
          color={C.white}
          size={18}
          weight={700}
          lineHeight={1}
        />
        <TextBox
          value={fitCopy(fields.tagline, { maxChars: 54, maxLines: 2, lineChars: 26 })}
          marginLeft={46}
          width={284}
          height={44}
          color={C.white}
          size={17}
          weight={400}
          lineHeight={1.16}
        />
      </div>
    </Canvas>
  );
}

function Flyer({ fields, disclaimer, origin, original }: Omit<RenderInput, "sizeKey">) {
  return (
    <Canvas width={1240} height={1754} format="flyer" origin={origin} original={original}>
      <Spacer height={274} />
      <TextBox
        value={fitCopy(fields.kicker, { maxChars: 34 })}
        marginLeft={166}
        width={548}
        height={34}
        color={C.blue}
        size={22}
        weight={700}
        lineHeight={1}
        align="center"
      />
      <Spacer height={50} />
      <Headline
        value={fitCopy(fields.headline, { maxChars: 50, maxLines: 3, lineChars: 20 })}
        marginLeft={78}
        width={595}
        height={250}
        size={69}
        lineHeight={1.03}
      />
      <Spacer height={28} />
      <Rule marginLeft={82} width={104} />
      <Spacer height={36} />
      <TextBox
        value={fitCopy(fields.body || supportingCopy(fields), { maxChars: 185, maxWords: 30, maxLines: 5, lineChars: 32 })}
        marginLeft={84}
        width={442}
        height={190}
        color={C.muted}
        size={27}
        weight={400}
        lineHeight={1.4}
      />
      <Spacer height={46} />
      <TextBox
        value={fitCopy(fields.benefit_1, { maxChars: 34, maxLines: 2, lineChars: 17 })}
        marginLeft={202}
        width={315}
        height={65}
        color={C.navy}
        size={23}
        weight={800}
        lineHeight={1.05}
      />
      <Spacer height={48} />
      <TextBox
        value={fitCopy(fields.benefit_2, { maxChars: 34, maxLines: 2, lineChars: 17 })}
        marginLeft={202}
        width={315}
        height={65}
        color={C.navy}
        size={23}
        weight={800}
        lineHeight={1.05}
      />
      <Spacer height={45} />
      <TextBox
        value={fitCopy(fields.benefit_3, { maxChars: 34, maxLines: 2, lineChars: 17 })}
        marginLeft={202}
        width={315}
        height={65}
        color={C.navy}
        size={23}
        weight={800}
        lineHeight={1.05}
      />
      <Spacer height={92} />
      <FlyerCta value={fitCopy(fields.cta, { maxChars: 24 })} marginLeft={0} width={548} height={126} size={39} />
      <Spacer height={118} />
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0, width: 1240, height: 62 }}>
        <TextBox
          value={fitCopy(fields.contact, { maxChars: 20, maxLines: 1, lineChars: 20 })}
          marginLeft={156}
          width={340}
          height={34}
          color={C.white}
          size={25}
          weight={800}
          lineHeight={1}
        />
        <TextBox
          value={fitCopy(fields.tagline, { maxChars: 48, maxLines: 2, lineChars: 24 })}
          marginLeft={75}
          width={310}
          height={50}
          color={C.white}
          size={23}
          weight={400}
          lineHeight={1.12}
        />
      </div>
      {/* The locked background's dark navy footer ends a little past the
          contact row; below that it's plain white, not the light-gray
          disclaimer strip in the reference (that strip is overlay, not
          baked art) — and the old dark-muted text color was invisible
          against the navy. Pin a real light bar to the bottom instead of
          guessing a fixed offset, and use a color that reads on it. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          marginTop: "auto",
          width: 1240,
          height: 80,
          backgroundColor: "#EDEEF0",
        }}
      >
        <TextBox
          value={fitCopy(disclaimer, { maxChars: 140, maxLines: 2, lineChars: 70 })}
          marginLeft={156}
          width={950}
          height={50}
          color={C.muted}
          size={16}
          weight={400}
          lineHeight={1.3}
        />
      </div>
    </Canvas>
  );
}

export function renderCaniGuard5(input: RenderInput): RenderResult {
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
