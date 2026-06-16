import React from "react";
import type { SizeKey } from "./creative";
import { fitCopy, type CopyFit } from "./render-copy";

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
  green: "#123C32",
  coral: "#C8613E",
  cream: "#F4E7D2",
  white: "#FFF9EF",
};

function assetUrl(
  origin: string,
  format: "square" | "story" | "feed" | "flyer",
  mode: "reference" | "background"
) {
  return new URL(
    `/assets/apex-canine/apex-canine-${format}-${mode}.png`,
    origin
  ).toString();
}

function supportingCopy(fields: Fields, fit?: CopyFit) {
  const value =
    fields.supportCopy ||
    fields.supportingCopy ||
    fields.subline ||
    fields.subheadline ||
    fields.body ||
    "";
  return fitCopy(value, fit);
}

function benefitItems(fields: Fields) {
  const numbered = [
    fields.benefit_1,
    fields.benefit_2,
    fields.benefit_3,
  ].filter(Boolean);
  if (numbered.length) return numbered;

  return (fields.benefits ?? "")
    .split(/\s*·\s*|\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function Spacer({ height }: { height: number }) {
  return <div style={{ display: "flex", flexShrink: 0, height }} />;
}

function TextBox({
  value,
  marginLeft,
  width,
  height,
  color = C.green,
  family = "Nunito Sans",
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
  family?: "Fraunces" | "Nunito Sans";
  size: number;
  weight: 400 | 600 | 700 | 800;
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
        fontFamily: family,
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
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: height,
          height,
          border: `2px solid ${C.coral}`,
          borderRadius: height,
          color: C.coral,
          fontFamily: "Nunito Sans",
          fontSize: size + 10,
          fontWeight: 400,
        }}
      >
        +
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: width - height - 18,
          height,
          marginLeft: 18,
          overflow: "hidden",
          color: C.green,
          fontFamily: "Nunito Sans",
          fontSize: size,
          fontWeight: 700,
          lineHeight: 1.15,
          whiteSpace: "pre-wrap",
        }}
      >
        {value}
      </div>
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
        justifyContent: "space-between",
        flexShrink: 0,
        width,
        height,
        marginLeft,
        paddingLeft: 28,
        paddingRight: 24,
        boxSizing: "border-box",
        borderRadius: 10,
        color: "#FFFFFF",
        backgroundColor: C.coral,
        fontFamily: "Nunito Sans",
        fontSize: size,
        fontWeight: 600,
      }}
    >
      <div style={{ display: "flex", flex: 1, overflow: "hidden", whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ display: "flex", flexShrink: 0, fontSize: size + 9, fontWeight: 400 }}>→</div>
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
    <Canvas
      width={1080}
      height={1080}
      format="square"
      origin={origin}
      original={original}
    >
      <Spacer height={315} />
      <Kicker
        value={fitCopy(fields.kicker, { maxChars: 26 })}
        marginLeft={82}
        width={420}
        height={56}
        size={22}
      />
      <Spacer height={35} />
      <TextBox
        value={fitCopy(fields.headline, { maxChars: 41, maxLines: 3, lineChars: 13 })}
        marginLeft={82}
        width={500}
        height={230}
        family="Fraunces"
        size={53}
        weight={700}
        lineHeight={1.03}
      />
      <Spacer height={28} />
      <TextBox
        value={supportingCopy(fields, { maxChars: 61, maxLines: 2, lineChars: 30 })}
        marginLeft={82}
        width={430}
        height={76}
        size={25}
        weight={400}
        lineHeight={1.3}
      />
      <Spacer height={22} />
      <Button
        value={fitCopy(fields.cta, { maxChars: 16 })}
        marginLeft={82}
        width={345}
        height={66}
        size={25}
      />
    </Canvas>
  );
}

function Story({ fields, origin, original }: Omit<RenderInput, "sizeKey">) {
  return (
    <Canvas
      width={1080}
      height={1920}
      format="story"
      origin={origin}
      original={original}
    >
      <Spacer height={525} />
      <Kicker
        value={fitCopy(fields.kicker, { maxChars: 25 })}
        marginLeft={124}
        width={500}
        height={70}
        size={28}
      />
      <Spacer height={54} />
      <TextBox
        value={fitCopy(fields.headline, { maxChars: 38, maxLines: 3, lineChars: 12 })}
        marginLeft={124}
        width={575}
        height={350}
        family="Fraunces"
        size={70}
        weight={700}
        lineHeight={1.04}
      />
      <Spacer height={42} />
      <TextBox
        value={supportingCopy(fields, { maxChars: 57, maxLines: 2, lineChars: 28 })}
        marginLeft={124}
        width={485}
        height={115}
        size={30}
        weight={400}
        lineHeight={1.3}
      />
      <Spacer height={55} />
      <Button
        value={fitCopy(fields.cta, { maxChars: 16 })}
        marginLeft={124}
        width={365}
        height={76}
        size={27}
      />
    </Canvas>
  );
}

function Feed({ fields, origin, original }: Omit<RenderInput, "sizeKey">) {
  return (
    <Canvas
      width={1200}
      height={630}
      format="feed"
      origin={origin}
      original={original}
    >
      <Spacer height={252} />
      <TextBox
        value={fitCopy(fields.headline, { maxChars: 37, maxLines: 2, lineChars: 18 })}
        marginLeft={100}
        width={535}
        height={125}
        family="Fraunces"
        size={42}
        weight={700}
        lineHeight={1.03}
      />
      <Spacer height={12} />
      <TextBox
        value={supportingCopy(fields, { maxChars: 61, maxLines: 2, lineChars: 30 })}
        marginLeft={100}
        width={380}
        height={58}
        size={22}
        weight={400}
        lineHeight={1.3}
      />
      <Spacer height={22} />
      <Button
        value={fitCopy(fields.cta, { maxChars: 16 })}
        marginLeft={100}
        width={296}
        height={57}
        size={21}
      />
    </Canvas>
  );
}

function Flyer({ fields, disclaimer, origin, original }: Omit<RenderInput, "sizeKey">) {
  const items = benefitItems(fields);

  return (
    <Canvas
      width={1240}
      height={1754}
      format="flyer"
      origin={origin}
      original={original}
    >
      <Spacer height={475} />
      <Kicker
        value={fitCopy(fields.kicker || fields.subheadline, { maxChars: 26 })}
        marginLeft={102}
        width={460}
        height={66}
        size={25}
      />
      <Spacer height={2} />
      <TextBox
        value={fitCopy(fields.headline, { maxChars: 44, maxLines: 3, lineChars: 14 })}
        marginLeft={100}
        width={565}
        height={250}
        family="Fraunces"
        size={58}
        weight={700}
        lineHeight={1.04}
      />
      <Spacer height={35} />
      <TextBox
        value={fitCopy(fields.body, { maxChars: 123, maxWords: 22, maxLines: 4, lineChars: 30 }) || supportingCopy(fields, { maxChars: 123, maxWords: 22, maxLines: 4, lineChars: 30 })}
        marginLeft={102}
        width={455}
        height={175}
        size={26}
        weight={400}
        lineHeight={1.35}
      />
      <Spacer height={330} />
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          width: 1240,
          height: 125,
        }}
      >
        {items.map((item, index) => (
          <TextBox
            key={index}
            value={fitCopy(item, { maxChars: 37, maxLines: 2, lineChars: 18 })}
            marginLeft={index === 0 ? 185 : 50}
            width={235}
            height={52}
            color={C.cream}
            size={21}
            weight={600}
            lineHeight={1.2}
            align="center"
          />
        ))}
      </div>
      <Spacer height={20} />
      <Button
        value={fitCopy(fields.cta, { maxChars: 22 })}
        marginLeft={326}
        width={570}
        height={78}
        size={34}
      />
      <Spacer height={70} />
      <TextBox
        value={fitCopy(fields.contact, { maxChars: 26, maxLines: 1, lineChars: 26 })}
        marginLeft={390}
        width={460}
        height={48}
        color={C.cream}
        size={31}
        weight={700}
        lineHeight={1}
        align="center"
      />
      <Spacer height={12} />
      <TextBox
        value={fitCopy(disclaimer, { maxChars: 180, maxLines: 2, lineChars: 90 })}
        marginLeft={225}
        width={790}
        height={42}
        color={C.cream}
        size={15}
        weight={400}
        lineHeight={1.2}
        align="center"
      />
    </Canvas>
  );
}

export function renderApexCanine(input: RenderInput): RenderResult {
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
