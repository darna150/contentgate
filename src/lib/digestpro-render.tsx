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
  green: "#043F2E",
  gold: "#C98311",
  goldDark: "#A86B0B",
  ink: "#172126",
  white: "#FFFFFF",
};

function assetUrl(
  origin: string,
  format: "square" | "story" | "feed" | "flyer",
  mode: "reference" | "background"
) {
  return new URL(
    `/assets/digestpro/digestpro-${format}-${mode}.png`,
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
  color = C.ink,
  family = "Nunito Sans",
  size,
  weight,
  lineHeight,
  align = "left",
  italic = false,
}: {
  value?: string;
  marginLeft: number;
  width: number;
  height: number;
  color?: string;
  family?: "Nunito Sans" | "Fraunces" | "Bree Serif";
  size: number;
  weight: 400 | 600 | 700 | 800;
  lineHeight: number;
  align?: "left" | "center";
  italic?: boolean;
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
        fontFamily: family,
        fontSize: size,
        fontStyle: italic ? "italic" : "normal",
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
  return (
    <TextBox
      value={value}
      marginLeft={marginLeft}
      width={width}
      height={height}
      color={C.green}
      family="Bree Serif"
      size={size}
      weight={400}
      lineHeight={lineHeight}
    />
  );
}

function Rule({ marginLeft, width, height = 4 }: { marginLeft: number; width: number; height?: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexShrink: 0,
        width,
        height,
        marginLeft,
        backgroundColor: C.gold,
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
        paddingLeft: 22,
        paddingRight: 34,
        boxSizing: "border-box",
        borderRadius: 18,
        backgroundColor: C.gold,
        color: C.white,
        fontFamily: "Bree Serif",
        fontSize: size,
        fontWeight: 400,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          width: height - 26,
          height: height - 26,
          marginRight: 22,
          border: "4px solid #FFFFFF",
          borderRadius: height,
          fontFamily: "Nunito Sans",
          fontSize: size + 16,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        &gt;
      </div>
      <div style={{ display: "flex", flex: 1, overflow: "hidden", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

function Benefit({
  value,
  marginLeft,
  icon,
  iconSize = 84,
  boxWidth = 260,
  boxHeight = 94,
  textWidth = 166,
  textSize = 23,
}: {
  value?: string;
  marginLeft: number;
  icon: string;
  iconSize?: number;
  boxWidth?: number;
  boxHeight?: number;
  textWidth?: number;
  textSize?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        width: boxWidth,
        height: boxHeight,
        marginLeft,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          width: iconSize,
          height: iconSize,
          marginRight: 16,
          border: `2px solid ${C.gold}`,
          borderRadius: iconSize,
          color: C.green,
          fontFamily: "Nunito Sans",
          fontSize: Math.round(iconSize * 0.45),
          fontWeight: 800,
        }}
      >
        {icon}
      </div>
      <TextBox
        value={value}
        marginLeft={0}
        width={textWidth}
        height={boxHeight}
        color={C.green}
        size={textSize}
        weight={800}
        lineHeight={1.05}
      />
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
    <Canvas width={1254} height={1254} format="square" origin={origin} original={original}>
      <Spacer height={294} />
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0, width: 640, height: 32 }}>
        <Rule marginLeft={88} width={65} />
        <TextBox
        value={fitCopy(fields.kicker, { maxChars: 44 })}
          marginLeft={18}
          width={450}
          height={32}
          color={C.goldDark}
          size={23}
          weight={600}
          lineHeight={1.05}
          italic
        />
      </div>
      <Spacer height={22} />
      <Headline
        value={fitCopy(fields.headline, { maxChars: 50, maxLines: 3, lineChars: 16 })}
        marginLeft={88}
        width={650}
        height={250}
        size={58}
        lineHeight={1.02}
      />
      <Spacer height={0} />
      <Rule marginLeft={90} width={96} />
      <Spacer height={27} />
      <TextBox
        value={supportingCopy(fields, { maxChars: 76, maxWords: 10, maxLines: 2, lineChars: 32 })}
        marginLeft={90}
        width={445}
        height={92}
        color={C.ink}
        size={26}
        weight={400}
        lineHeight={1.35}
      />
      <Spacer height={445} />
      <Button value={fitCopy(fields.cta, { maxChars: 15 })} marginLeft={732} width={416} height={74} size={34} />
    </Canvas>
  );
}

function Story({ fields, origin, original }: Omit<RenderInput, "sizeKey">) {
  return (
    <Canvas width={941} height={1672} format="story" origin={origin} original={original}>
      <Spacer height={382} />
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0, width: 560, height: 28 }}>
        <Rule marginLeft={60} width={60} />
        <TextBox
          value={fitCopy(fields.kicker, { maxChars: 44 })}
          marginLeft={18}
          width={420}
          height={28}
          color={C.goldDark}
          size={21}
          weight={600}
          lineHeight={1.05}
          italic
        />
      </div>
      <Spacer height={30} />
      <Headline
        value={fitCopy(fields.headline, { maxChars: 50, maxLines: 3, lineChars: 16 })}
        marginLeft={60}
        width={650}
        height={318}
        size={58}
        lineHeight={1.04}
      />
      <Spacer height={0} />
      <Rule marginLeft={60} width={120} />
      <Spacer height={28} />
      <TextBox
        value={supportingCopy(fields, { maxChars: 105, maxWords: 14, maxLines: 3, lineChars: 32 })}
        marginLeft={60}
        width={420}
        height={88}
        color={C.ink}
        size={24}
        weight={400}
        lineHeight={1.35}
      />
      <Spacer height={680} />
      <Button value={fitCopy(fields.cta, { maxChars: 16 })} marginLeft={222} width={482} height={100} size={36} />
    </Canvas>
  );
}

function Feed({ fields, origin, original }: Omit<RenderInput, "sizeKey">) {
  return (
    <Canvas width={1731} height={909} format="feed" origin={origin} original={original}>
      <Spacer height={334} />
      <Headline
        value={fitCopy(fields.headline, { maxChars: 41, maxLines: 3, lineChars: 13 })}
        marginLeft={90}
        width={640}
        height={230}
        size={70}
        lineHeight={1.04}
      />
      <Spacer height={22} />
      <Rule marginLeft={90} width={118} height={5} />
      <Spacer height={28} />
      <TextBox
        value={supportingCopy(fields, { maxChars: 105, maxWords: 14, maxLines: 3, lineChars: 35 })}
        marginLeft={90}
        width={540}
        height={84}
        color={C.ink}
        size={27}
        weight={400}
        lineHeight={1.34}
      />
      <Spacer height={48} />
      <Button value={fitCopy(fields.cta, { maxChars: 15 })} marginLeft={90} width={444} height={76} size={34} />
    </Canvas>
  );
}

function Flyer({ fields, disclaimer, origin, original }: Omit<RenderInput, "sizeKey">) {
  return (
    <Canvas width={1055} height={1491} format="flyer" origin={origin} original={original}>
      <Spacer height={302} />
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0, width: 640, height: 28 }}>
        <Rule marginLeft={58} width={60} />
        <TextBox
          value={fitCopy(fields.kicker, { maxChars: 44 })}
          marginLeft={14}
          width={430}
          height={28}
          color={C.goldDark}
          size={21}
          weight={600}
          lineHeight={1.05}
          italic
        />
      </div>
      <Spacer height={24} />
      <Headline
        value={fitCopy(fields.headline, { maxChars: 50, maxLines: 3, lineChars: 16 })}
        marginLeft={58}
        width={650}
        height={210}
        size={58}
        lineHeight={1.03}
      />
      <Spacer height={20} />
      <Rule marginLeft={58} width={130} height={5} />
      <Spacer height={20} />
      <TextBox
        value={fitCopy(fields.body || supportingCopy(fields), { maxChars: 210, maxWords: 34, maxLines: 5, lineChars: 38 })}
        marginLeft={58}
        width={460}
        height={150}
        color={C.ink}
        size={22}
        weight={400}
        lineHeight={1.36}
      />
      {/* The packshot bag + spilled feed in the locked background art run to
          y~1260 (taller than the reference composition), so this row must
          start after that, not after the reference's shorter bag. */}
      <Spacer height={511} />
      <div style={{ display: "flex", flexShrink: 0, width: 1055, height: 90 }}>
        <Benefit
          value={fitCopy(fields.benefit_1, { maxChars: 34, maxLines: 3, lineChars: 12 })}
          marginLeft={80}
          icon="1"
          iconSize={70}
          boxWidth={240}
          boxHeight={90}
          textWidth={156}
          textSize={20}
        />
        <div style={{ display: "flex", flexShrink: 0, width: 1, height: 64, marginLeft: 10, backgroundColor: "#B7AA93" }} />
        <Benefit
          value={fitCopy(fields.benefit_2, { maxChars: 34, maxLines: 3, lineChars: 12 })}
          marginLeft={34}
          icon="2"
          iconSize={70}
          boxWidth={240}
          boxHeight={90}
          textWidth={156}
          textSize={20}
        />
        <div style={{ display: "flex", flexShrink: 0, width: 1, height: 64, marginLeft: 10, backgroundColor: "#B7AA93" }} />
        <Benefit
          value={fitCopy(fields.benefit_3, { maxChars: 34, maxLines: 3, lineChars: 12 })}
          marginLeft={34}
          icon="3"
          iconSize={70}
          boxWidth={240}
          boxHeight={90}
          textWidth={156}
          textSize={20}
        />
      </div>
      <Spacer height={10} />
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0, width: 1055, height: 60 }}>
        <Button value={fitCopy(fields.cta, { maxChars: 15 })} marginLeft={80} width={330} height={56} size={24} />
        <div style={{ display: "flex", flexShrink: 0, width: 1, height: 46, marginLeft: 32, backgroundColor: "#B7AA93" }} />
        <TextBox
          value={fitCopy(fields.contact, { maxChars: 16, maxLines: 1, lineChars: 16 })}
          marginLeft={32}
          width={250}
          height={34}
          color={C.green}
          size={24}
          weight={800}
          lineHeight={1}
        />
      </div>
      <Spacer height={10} />
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0, width: 1055, height: 45, backgroundColor: C.green }}>
        <TextBox
          value={fitCopy(disclaimer, { maxChars: 100, maxLines: 1 })}
          marginLeft={80}
          width={895}
          height={24}
          color={C.white}
          size={13}
          weight={400}
          lineHeight={1.1}
        />
      </div>
    </Canvas>
  );
}

export function renderDigestPro(input: RenderInput): RenderResult {
  if (input.sizeKey === "story") {
    return { element: <Story {...input} />, w: 941, h: 1672 };
  }
  if (input.sizeKey === "feed") {
    return { element: <Feed {...input} />, w: 1731, h: 909 };
  }
  if (input.sizeKey === "a4") {
    return { element: <Flyer {...input} />, w: 1055, h: 1491 };
  }
  return { element: <Square {...input} />, w: 1254, h: 1254 };
}
