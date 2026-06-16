import React from "react";
import type { SizeKey } from "./creative";
import { fitCopy, pickCopy, type CopyFit } from "./render-copy";
import { getRenderFits, type RenderFit } from "./template-specs";

type Fields = Record<string, string>;

type RenderInput = {
  layoutKey: string;
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

type Format = "square" | "story" | "feed" | "flyer";

type Family = "digestpro" | "caniguard5" | "poultryshieldpro" | "swineguardplus";

const DIMS: Record<Family, Record<Format, { w: number; h: number }>> = {
  digestpro: {
    square: { w: 1254, h: 1254 },
    story: { w: 941, h: 1672 },
    feed: { w: 1731, h: 909 },
    flyer: { w: 1055, h: 1491 },
  },
  caniguard5: {
    square: { w: 1080, h: 1080 },
    story: { w: 1080, h: 1920 },
    feed: { w: 1200, h: 630 },
    flyer: { w: 1240, h: 1754 },
  },
  poultryshieldpro: {
    square: { w: 1254, h: 1254 },
    story: { w: 941, h: 1672 },
    feed: { w: 1731, h: 909 },
    flyer: { w: 1055, h: 1491 },
  },
  swineguardplus: {
    square: { w: 1080, h: 1080 },
    story: { w: 1080, h: 1920 },
    feed: { w: 1200, h: 630 },
    flyer: { w: 1240, h: 1754 },
  },
};

function resolveFamily(layoutKey: string): Family | null {
  if (layoutKey.startsWith("digestpro_")) return "digestpro";
  if (layoutKey.startsWith("caniguard5_")) return "caniguard5";
  if (layoutKey.startsWith("poultryshieldpro_")) return "poultryshieldpro";
  if (layoutKey.startsWith("swineguardplus_")) return "swineguardplus";
  return null;
}

function resolveFormat(sizeKey?: SizeKey): Format {
  if (sizeKey === "story") return "story";
  if (sizeKey === "feed") return "feed";
  if (sizeKey === "a4") return "flyer";
  return "square";
}

function assetUrl(origin: string, family: Family, format: Format, original?: boolean) {
  return new URL(
    `/assets/${family}/${family}-${format}-${original ? "reference" : "background"}.png`,
    origin
  ).toString();
}

function supportingCopy(fields: Fields, key: "supportCopy" | "body", fits: Record<string, RenderFit>) {
  return fitted(
    key === "body"
      ? pickCopy(fields, ["body", "supporting", "supportCopy", "supportingCopy", "subline", "subheadline"])
      : pickCopy(fields, ["supportCopy", "supportingCopy", "supporting", "subline", "subheadline", "body"]),
    fits[key]
  );
}

function toCopyFit(fit?: RenderFit): CopyFit | undefined {
  if (!fit) return undefined;
  return {
    maxChars: fit.max_chars,
    maxWords: fit.max_words,
    maxLines: fit.max_lines,
    lineChars: fit.line_chars,
  };
}

function fitted(value: unknown, fit?: RenderFit) {
  return fitCopy(value, toCopyFit(fit));
}

function Spacer({ height }: { height: number }) {
  return <div style={{ display: "flex", flexShrink: 0, height }} />;
}

function Canvas({
  width,
  height,
  family,
  format,
  origin,
  original,
  children,
}: {
  width: number;
  height: number;
  family: Family;
  format: Format;
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
        backgroundImage: `url(${assetUrl(origin, family, format, original)})`,
        backgroundSize: `${width}px ${height}px`,
        backgroundRepeat: "no-repeat",
      }}
    >
      {!original && children}
    </div>
  );
}

function TextBox({
  value,
  marginLeft,
  width,
  height,
  color,
  family,
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
  color: string;
  family: string;
  size: number;
  weight: 400 | 500 | 600 | 700 | 800;
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
  color,
  family,
  size,
  weight,
  lineHeight,
  letterSpacing,
  lineColors,
}: {
  value?: string;
  marginLeft: number;
  width: number;
  height: number;
  color: string;
  family: string;
  size: number;
  weight: 400 | 500 | 600 | 700 | 800;
  lineHeight: number;
  letterSpacing?: string;
  lineColors?: string[];
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
        color,
        fontFamily: family,
        fontSize: size,
        fontWeight: weight,
        lineHeight,
        letterSpacing,
        whiteSpace: "pre-wrap",
      }}
    >
      {lines.map((line, index) => (
        <div
          key={`${line}-${index}`}
          style={{
            display: "flex",
            flexShrink: 0,
            color: lineColors?.[index] ?? color,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

function Rule({
  marginLeft,
  width,
  height,
  color,
  radius,
}: {
  marginLeft: number;
  width: number;
  height: number;
  color: string;
  radius?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexShrink: 0,
        width,
        height,
        marginLeft,
        borderRadius: radius ?? 0,
        backgroundColor: color,
      }}
    />
  );
}

function DigestButton({
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
        backgroundColor: "#C98311",
        color: "#FFFFFF",
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

function CaniButton({
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
        color: "#FFFFFF",
        backgroundColor: "#061D4C",
        fontFamily: "Roboto",
        fontSize: size,
        fontWeight: 700,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex" }}>{value}</div>
      </div>
      <div style={{ display: "flex", color: "#0667D8", fontSize: size + 14, fontWeight: 700 }}>
        &gt;
      </div>
    </div>
  );
}

function PoultryCta({
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
  const text = value ?? "";
  const spaceIndex = text.indexOf(" ");
  const first = spaceIndex >= 0 ? text.slice(0, spaceIndex) : text;
  const rest = spaceIndex >= 0 ? text.slice(spaceIndex + 1) : "";
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
      <div style={{ display: "flex", color: "#FFFFFF" }}>{first}&nbsp;</div>
      <div style={{ display: "flex", color: "#FF6A2D" }}>{rest}&nbsp;&gt;</div>
    </div>
  );
}

function SwineSocialCta({
  value,
  marginLeft,
  circleSize,
  fontSize,
}: {
  value?: string;
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
          backgroundColor: "#C0272D",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#FFFFFF",
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
          color: "#C0272D",
          fontFamily: "Roboto",
          fontWeight: 700,
          fontSize,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SwineFlyerCta({
  value,
  marginLeft,
  width,
}: {
  value?: string;
  marginLeft: number;
  width: number;
}) {
  return (
    <div style={{ display: "flex", flexShrink: 0, alignItems: "flex-start", marginLeft, width }}>
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          color: "#C0272D",
          fontFamily: "Roboto",
          fontWeight: 800,
          fontSize: 44,
          lineHeight: 1.08,
          marginRight: 12,
          marginTop: 4,
        }}
      >
        &gt;
      </div>
      <div
        style={{
          display: "flex",
          color: "#C0272D",
          fontFamily: "Roboto",
          fontWeight: 800,
          fontSize: 38,
          lineHeight: 1.08,
          whiteSpace: "pre-wrap",
          overflow: "hidden",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function renderDigestPro(input: RenderInput, format: Format): RenderResult {
  const fits = getRenderFits(input.layoutKey);
  const dims = DIMS.digestpro[format];
  const headline = fitted(input.fields.headline, fits.headline);
  const kicker = fitted(input.fields.kicker, fits.kicker);
  const support = supportingCopy(input.fields, format === "flyer" ? "body" : "supportCopy", fits);
  const cta = fitted(input.fields.cta, fits.cta);
  const contact = fitted(input.fields.contact, fits.contact);

  let element: React.ReactElement;

  if (format === "square") {
    element = (
      <Canvas width={dims.w} height={dims.h} family="digestpro" format={format} origin={input.origin} original={input.original}>
        <Spacer height={294} />
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, width: 640, height: 32 }}>
          <Rule marginLeft={88} width={65} height={4} color="#C98311" />
          <TextBox value={kicker} marginLeft={18} width={450} height={32} color="#A86B0B" family="Nunito Sans" size={23} weight={600} lineHeight={1.05} italic />
        </div>
        <Spacer height={22} />
        <Headline value={headline} marginLeft={88} width={650} height={250} color="#043F2E" family="Bree Serif" size={58} weight={400} lineHeight={1.02} />
        <Rule marginLeft={90} width={96} height={4} color="#C98311" />
        <Spacer height={27} />
        <TextBox value={support} marginLeft={90} width={445} height={92} color="#172126" family="Nunito Sans" size={26} weight={400} lineHeight={1.35} />
        <Spacer height={445} />
        <DigestButton value={cta} marginLeft={732} width={416} height={74} size={34} />
      </Canvas>
    );
  } else if (format === "story") {
    element = (
      <Canvas width={dims.w} height={dims.h} family="digestpro" format={format} origin={input.origin} original={input.original}>
        <Spacer height={382} />
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, width: 560, height: 28 }}>
          <Rule marginLeft={60} width={60} height={4} color="#C98311" />
          <TextBox value={kicker} marginLeft={18} width={420} height={28} color="#A86B0B" family="Nunito Sans" size={21} weight={600} lineHeight={1.05} italic />
        </div>
        <Spacer height={30} />
        <Headline value={headline} marginLeft={60} width={650} height={318} color="#043F2E" family="Bree Serif" size={58} weight={400} lineHeight={1.04} />
        <Rule marginLeft={60} width={120} height={4} color="#C98311" />
        <Spacer height={28} />
        <TextBox value={support} marginLeft={60} width={420} height={88} color="#172126" family="Nunito Sans" size={24} weight={400} lineHeight={1.35} />
        <Spacer height={680} />
        <DigestButton value={cta} marginLeft={222} width={482} height={100} size={36} />
      </Canvas>
    );
  } else if (format === "feed") {
    element = (
      <Canvas width={dims.w} height={dims.h} family="digestpro" format={format} origin={input.origin} original={input.original}>
        <Spacer height={334} />
        <Headline value={headline} marginLeft={90} width={640} height={230} color="#043F2E" family="Bree Serif" size={70} weight={400} lineHeight={1.04} />
        <Spacer height={22} />
        <Rule marginLeft={90} width={118} height={5} color="#C98311" />
        <Spacer height={28} />
        <TextBox value={support} marginLeft={90} width={540} height={84} color="#172126" family="Nunito Sans" size={27} weight={400} lineHeight={1.34} />
        <Spacer height={48} />
        <DigestButton value={cta} marginLeft={90} width={444} height={76} size={34} />
      </Canvas>
    );
  } else {
    element = (
      <Canvas width={dims.w} height={dims.h} family="digestpro" format={format} origin={input.origin} original={input.original}>
        <Spacer height={302} />
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, width: 640, height: 28 }}>
          <Rule marginLeft={58} width={60} height={4} color="#C98311" />
          <TextBox value={kicker} marginLeft={14} width={430} height={28} color="#A86B0B" family="Nunito Sans" size={21} weight={600} lineHeight={1.05} italic />
        </div>
        <Spacer height={24} />
        <Headline value={headline} marginLeft={58} width={650} height={210} color="#043F2E" family="Bree Serif" size={58} weight={400} lineHeight={1.03} />
        <Spacer height={20} />
        <Rule marginLeft={58} width={130} height={5} color="#C98311" />
        <Spacer height={20} />
        <TextBox value={support} marginLeft={58} width={460} height={150} color="#172126" family="Nunito Sans" size={22} weight={400} lineHeight={1.36} />
        <Spacer height={430} />
        <div style={{ display: "flex", flexShrink: 0, width: 1055, height: 104 }}>
          <TextBox value={fitted(input.fields.benefit_1, fits.benefit_1)} marginLeft={180} width={146} height={84} color="#043F2E" family="Nunito Sans" size={23} weight={800} lineHeight={1.05} />
          <TextBox value={fitted(input.fields.benefit_2, fits.benefit_2)} marginLeft={167} width={146} height={84} color="#043F2E" family="Nunito Sans" size={23} weight={800} lineHeight={1.05} />
          <TextBox value={fitted(input.fields.benefit_3, fits.benefit_3)} marginLeft={153} width={175} height={84} color="#043F2E" family="Nunito Sans" size={23} weight={800} lineHeight={1.05} />
        </div>
        <Spacer height={18} />
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, width: 1055, height: 74 }}>
          <DigestButton value={cta} marginLeft={124} width={385} height={68} size={29} />
          <div style={{ display: "flex", flexShrink: 0, width: 1, height: 60, marginLeft: 32, backgroundColor: "#B7AA93" }} />
          <TextBox value={contact} marginLeft={34} width={244} height={42} color="#043F2E" family="Nunito Sans" size={30} weight={800} lineHeight={1} />
        </div>
        <Spacer height={38} />
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, width: 1055, height: 74, backgroundColor: "#043F2E" }}>
          <TextBox value={input.disclaimer} marginLeft={96} width={650} height={28} color="#FFFFFF" family="Nunito Sans" size={14} weight={400} lineHeight={1.1} />
        </div>
      </Canvas>
    );
  }

  return { element, ...dims };
}

function renderCaniGuard5(input: RenderInput, format: Format): RenderResult {
  const fits = getRenderFits(input.layoutKey);
  const dims = DIMS.caniguard5[format];
  const headline = fitted(input.fields.headline, fits.headline);
  const kicker = fitted(input.fields.kicker, fits.kicker);
  const support = supportingCopy(input.fields, format === "flyer" ? "body" : "supportCopy", fits);
  const cta = fitted(input.fields.cta, fits.cta);
  const contact = fitted(input.fields.contact, fits.contact);
  const tagline = fitted(input.fields.tagline, fits.tagline);

  let element: React.ReactElement;

  if (format === "square") {
    element = (
      <Canvas width={dims.w} height={dims.h} family="caniguard5" format={format} origin={input.origin} original={input.original}>
        <Spacer height={192} />
        <TextBox value={kicker} marginLeft={174} width={470} height={34} color="#0667D8" family="Roboto" size={20} weight={700} lineHeight={1} align="center" />
        <Spacer height={46} />
        <Headline value={headline} marginLeft={54} width={540} height={235} color="#061D4C" family="Roboto" size={72} weight={800} lineHeight={1.02} letterSpacing="-0.04em" lineColors={["#061D4C", "#061D4C", "#0667D8"]} />
        <Spacer height={24} />
        <Rule marginLeft={58} width={98} height={7} color="#0667D8" radius={7} />
        <Spacer height={34} />
        <TextBox value={support} marginLeft={58} width={475} height={118} color="#1F2D44" family="Roboto" size={27} weight={400} lineHeight={1.35} />
        <Spacer height={92} />
        <CaniButton value={cta} marginLeft={64} width={424} height={100} size={29} />
      </Canvas>
    );
  } else if (format === "story") {
    element = (
      <Canvas width={dims.w} height={dims.h} family="caniguard5" format={format} origin={input.origin} original={input.original}>
        <Spacer height={318} />
        <TextBox value={kicker} marginLeft={220} width={520} height={38} color="#0667D8" family="Roboto" size={22} weight={700} lineHeight={1} align="center" />
        <Spacer height={70} />
        <Headline value={headline} marginLeft={74} width={760} height={292} color="#061D4C" family="Roboto" size={78} weight={800} lineHeight={1.05} letterSpacing="-0.04em" lineColors={["#061D4C", "#061D4C", "#0667D8"]} />
        <Spacer height={28} />
        <Rule marginLeft={80} width={98} height={7} color="#0667D8" radius={7} />
        <Spacer height={40} />
        <TextBox value={support} marginLeft={78} width={500} height={136} color="#1F2D44" family="Roboto" size={28} weight={400} lineHeight={1.42} />
        <Spacer height={106} />
        <CaniButton value={cta} marginLeft={248} width={584} height={116} size={38} />
      </Canvas>
    );
  } else if (format === "feed") {
    element = (
      <Canvas width={dims.w} height={dims.h} family="caniguard5" format={format} origin={input.origin} original={input.original}>
        <Spacer height={150} />
        <Headline value={headline} marginLeft={56} width={438} height={158} color="#061D4C" family="Roboto" size={48} weight={800} lineHeight={1} letterSpacing="-0.04em" lineColors={["#061D4C", "#061D4C", "#0667D8"]} />
        <Spacer height={12} />
        <Rule marginLeft={58} width={96} height={6} color="#0667D8" radius={6} />
        <Spacer height={24} />
        <TextBox value={support} marginLeft={58} width={455} height={66} color="#1F2D44" family="Roboto" size={19} weight={400} lineHeight={1.35} />
        <Spacer height={19} />
        <CaniButton value={cta} marginLeft={58} width={356} height={63} size={24} />
        <Spacer height={43} />
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, width: 1200, height: 50 }}>
          <TextBox value={contact} marginLeft={120} width={180} height={25} color="#FFFFFF" family="Roboto" size={19} weight={700} lineHeight={1} />
          <TextBox value={tagline} marginLeft={138} width={310} height={44} color="#FFFFFF" family="Roboto" size={19} weight={400} lineHeight={1.16} />
        </div>
      </Canvas>
    );
  } else {
    element = (
      <Canvas width={dims.w} height={dims.h} family="caniguard5" format={format} origin={input.origin} original={input.original}>
        <Spacer height={274} />
        <TextBox value={kicker} marginLeft={166} width={548} height={34} color="#0667D8" family="Roboto" size={22} weight={700} lineHeight={1} align="center" />
        <Spacer height={50} />
        <Headline value={headline} marginLeft={78} width={595} height={250} color="#061D4C" family="Roboto" size={69} weight={800} lineHeight={1.03} letterSpacing="-0.04em" lineColors={["#061D4C", "#061D4C", "#0667D8"]} />
        <Spacer height={28} />
        <Rule marginLeft={82} width={104} height={7} color="#0667D8" radius={7} />
        <Spacer height={36} />
        <TextBox value={support} marginLeft={84} width={442} height={190} color="#1F2D44" family="Roboto" size={27} weight={400} lineHeight={1.4} />
        <Spacer height={46} />
        <TextBox value={fitted(input.fields.benefit_1, fits.benefit_1)} marginLeft={202} width={315} height={65} color="#061D4C" family="Roboto" size={23} weight={800} lineHeight={1.05} />
        <Spacer height={48} />
        <TextBox value={fitted(input.fields.benefit_2, fits.benefit_2)} marginLeft={202} width={315} height={65} color="#061D4C" family="Roboto" size={23} weight={800} lineHeight={1.05} />
        <Spacer height={45} />
        <TextBox value={fitted(input.fields.benefit_3, fits.benefit_3)} marginLeft={202} width={315} height={65} color="#061D4C" family="Roboto" size={23} weight={800} lineHeight={1.05} />
        <Spacer height={92} />
        <CaniButton value={cta} marginLeft={0} width={548} height={126} size={39} />
        <Spacer height={118} />
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, width: 1240, height: 62 }}>
          <TextBox value={contact} marginLeft={156} width={255} height={30} color="#FFFFFF" family="Roboto" size={24} weight={700} lineHeight={1} />
          <TextBox value={tagline} marginLeft={108} width={400} height={52} color="#FFFFFF" family="Roboto" size={23} weight={400} lineHeight={1.12} />
        </div>
        <Spacer height={118} />
        <TextBox value={input.disclaimer} marginLeft={132} width={900} height={56} color="#FFFFFF" family="Roboto" size={18} weight={400} lineHeight={1.3} />
      </Canvas>
    );
  }

  return { element, ...dims };
}

function renderPoultryShieldPro(input: RenderInput, format: Format): RenderResult {
  const fits = getRenderFits(input.layoutKey);
  const dims = DIMS.poultryshieldpro[format];
  const headline = fitted(input.fields.headline, fits.headline);
  const kicker = fitted(input.fields.kicker, fits.kicker);
  const support = supportingCopy(input.fields, format === "flyer" ? "body" : "supportCopy", fits);
  const cta = fitted(input.fields.cta, fits.cta);
  const contact = fitted(input.fields.contact, fits.contact);

  let element: React.ReactElement;

  if (format === "square") {
    element = (
      <Canvas width={dims.w} height={dims.h} family="poultryshieldpro" format={format} origin={input.origin} original={input.original}>
        <Spacer height={304} />
        <TextBox value={kicker} marginLeft={66} width={560} height={32} color="#FF6A2D" family="Roboto" size={25} weight={600} lineHeight={1} />
        <Spacer height={10} />
        <Headline value={headline} marginLeft={66} width={610} height={248} color="#FFFFFF" family="Roboto" size={78} weight={800} lineHeight={1.04} letterSpacing="-0.02em" lineColors={["#FFFFFF", "#FF6A2D", "#F2B23D"]} />
        <Spacer height={18} />
        <TextBox value={support} marginLeft={66} width={490} height={74} color="#FFFFFF" family="Roboto" size={26} weight={400} lineHeight={1.32} />
        <Spacer height={319} />
        <PoultryCta value={cta} marginLeft={186} width={530} height={48} size={34} />
      </Canvas>
    );
  } else if (format === "story") {
    element = (
      <Canvas width={dims.w} height={dims.h} family="poultryshieldpro" format={format} origin={input.origin} original={input.original}>
        <Spacer height={414} />
        <TextBox value={kicker} marginLeft={60} width={480} height={28} color="#FF6A2D" family="Roboto" size={22} weight={600} lineHeight={1} />
        <Spacer height={10} />
        <Headline value={headline} marginLeft={60} width={560} height={220} color="#FFFFFF" family="Roboto" size={66} weight={800} lineHeight={1.04} letterSpacing="-0.02em" lineColors={["#FFFFFF", "#FF6A2D", "#F2B23D"]} />
        <Spacer height={18} />
        <TextBox value={support} marginLeft={60} width={404} height={72} color="#FFFFFF" family="Roboto" size={24} weight={400} lineHeight={1.32} />
        {/* CTA sits below the packshot bag in the reference (~y1530 of
            1672), not crowding its label text — the old 620px gap landed
            mid-bag. */}
        <Spacer height={768} />
        <PoultryCta value={cta} marginLeft={130} width={470} height={42} size={30} />
      </Canvas>
    );
  } else if (format === "feed") {
    element = (
      <Canvas width={dims.w} height={dims.h} family="poultryshieldpro" format={format} origin={input.origin} original={input.original}>
        <Spacer height={276} />
        <Headline value={headline} marginLeft={78} width={812} height={314} color="#FFFFFF" family="Roboto" size={96} weight={800} lineHeight={1.02} letterSpacing="-0.02em" lineColors={["#FFFFFF", "#FF6A2D", "#F2B23D"]} />
        <Spacer height={48} />
        <TextBox value={support} marginLeft={80} width={486} height={72} color="#FFFFFF" family="Roboto" size={30} weight={400} lineHeight={1.3} />
        <Spacer height={27} />
        <PoultryCta value={cta} marginLeft={74} width={662} height={56} size={38} />
      </Canvas>
    );
  } else {
    element = (
      <Canvas width={dims.w} height={dims.h} family="poultryshieldpro" format={format} origin={input.origin} original={input.original}>
        <Spacer height={300} />
        <TextBox value={kicker} marginLeft={64} width={460} height={28} color="#FF6A2D" family="Roboto" size={20} weight={600} lineHeight={1} />
        <Spacer height={10} />
        <Headline value={headline} marginLeft={64} width={540} height={220} color="#FFFFFF" family="Roboto" size={60} weight={800} lineHeight={1.05} letterSpacing="-0.02em" lineColors={["#FFFFFF", "#FF6A2D", "#F2B23D"]} />
        <Spacer height={18} />
        <Rule marginLeft={64} width={360} height={4} color="#F2B23D" />
        <Spacer height={18} />
        <TextBox value={support} marginLeft={64} width={344} height={138} color="#FFFFFF" family="Roboto" size={21} weight={400} lineHeight={1.35} />
        <Spacer height={44} />
        <TextBox value={fitted(input.fields.benefit_1, fits.benefit_1)} marginLeft={176} width={320} height={50} color="#FFFFFF" family="Roboto" size={18} weight={700} lineHeight={1.2} />
        <Spacer height={68} />
        <TextBox value={fitted(input.fields.benefit_2, fits.benefit_2)} marginLeft={176} width={320} height={50} color="#FFFFFF" family="Roboto" size={18} weight={700} lineHeight={1.2} />
        <Spacer height={68} />
        <TextBox value={fitted(input.fields.benefit_3, fits.benefit_3)} marginLeft={176} width={320} height={56} color="#FFFFFF" family="Roboto" size={18} weight={700} lineHeight={1.2} />
        <Spacer height={86} />
        {/* The product box/carton art sits at roughly x560-870 here, so the
            contact text must start past it (~x680, matching the reference's
            far-right globe+url), not immediately after the CTA. */}
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, width: 1055, height: 36 }}>
          <PoultryCta value={cta} marginLeft={142} width={350} height={36} size={28} />
          <TextBox value={contact} marginLeft={188} width={340} height={28} color="#FFFFFF" family="Roboto" size={20} weight={500} lineHeight={1} />
        </div>
        <Spacer height={66} />
        <TextBox value={input.disclaimer} marginLeft={110} width={800} height={52} color="#C8C0B0" family="Roboto" size={16} weight={400} lineHeight={1.3} />
      </Canvas>
    );
  }

  return { element, ...dims };
}

function renderSwineGuardPlus(input: RenderInput, format: Format): RenderResult {
  const fits = getRenderFits(input.layoutKey);
  const dims = DIMS.swineguardplus[format];
  const headline = fitted(input.fields.headline, fits.headline);
  const kicker = fitted(input.fields.kicker, fits.kicker);
  const support = supportingCopy(input.fields, format === "flyer" ? "body" : "supportCopy", fits);
  const cta = fitted(input.fields.cta, fits.cta);
  const contact = fitted(input.fields.contact, fits.contact);

  let element: React.ReactElement;

  if (format === "square") {
    // Positions measured against swineguardplus-square-reference.png:
    // logo bottom ~230, kicker top ~345, headline top ~395, support top
    // ~775, CTA top ~885. The old 258px top spacer crowded the kicker
    // straight onto the "PLUS" wordmark.
    element = (
      <Canvas width={dims.w} height={dims.h} family="swineguardplus" format={format} origin={input.origin} original={input.original}>
        <Spacer height={345} />
        <TextBox value={kicker} marginLeft={54} width={500} height={30} color="#C0272D" family="Roboto" size={21} weight={400} lineHeight={1} />
        <Spacer height={20} />
        <Headline value={headline} marginLeft={54} width={520} height={230} color="#C0272D" family="Roboto" size={62} weight={800} lineHeight={1.06} letterSpacing="-0.02em" />
        <Spacer height={150} />
        <TextBox value={support} marginLeft={54} width={448} height={60} color="#444444" family="Roboto" size={22} weight={400} lineHeight={1.32} />
        <Spacer height={50} />
        <SwineSocialCta value={cta} marginLeft={54} circleSize={52} fontSize={26} />
      </Canvas>
    );
  } else if (format === "story") {
    // Positions measured against swineguardplus-story-reference.png: kicker
    // top ~395, headline top ~460, support top ~800, CTA top ~920. The old
    // 945px spacer pushed the CTA almost to the bottom of the canvas, onto
    // the feed-pile photo, when the original design places it right under
    // the support copy with the pig photo filling the rest of the frame.
    element = (
      <Canvas width={dims.w} height={dims.h} family="swineguardplus" format={format} origin={input.origin} original={input.original}>
        <Spacer height={395} />
        <TextBox value={kicker} marginLeft={54} width={560} height={35} color="#C0272D" family="Roboto" size={24} weight={400} lineHeight={1} />
        <Spacer height={30} />
        <Headline value={headline} marginLeft={54} width={630} height={310} color="#C0272D" family="Roboto" size={76} weight={800} lineHeight={1.07} letterSpacing="-0.02em" />
        <Spacer height={30} />
        <TextBox value={support} marginLeft={54} width={520} height={70} color="#444444" family="Roboto" size={25} weight={400} lineHeight={1.35} />
        <Spacer height={50} />
        <SwineSocialCta value={cta} marginLeft={54} circleSize={60} fontSize={28} />
      </Canvas>
    );
  } else if (format === "feed") {
    // Positions measured against swineguardplus-feed-reference.png: logo
    // bottom ~135, headline top ~160, support top ~460, CTA top ~545. The
    // old 118px top spacer put the headline directly under/through the
    // logo wordmark.
    element = (
      <Canvas width={dims.w} height={dims.h} family="swineguardplus" format={format} origin={input.origin} original={input.original}>
        <Spacer height={180} />
        <Headline value={headline} marginLeft={54} width={530} height={260} color="#C0272D" family="Roboto" size={46} weight={800} lineHeight={1.25} letterSpacing="-0.02em" />
        <Spacer height={40} />
        <TextBox value={support} marginLeft={54} width={480} height={50} color="#444444" family="Roboto" size={20} weight={400} lineHeight={1.3} />
        <Spacer height={35} />
        <SwineSocialCta value={cta} marginLeft={54} circleSize={46} fontSize={22} />
      </Canvas>
    );
  } else {
    // Positions measured against swineguardplus-flyer-reference.png: kicker
    // top ~430, headline top ~480, support top ~825, the three benefit-icon
    // rows at ~935/1040/1145, CTA top ~1390, website top ~1500. The benefit
    // icons in the locked background sit at x~60-130, so labels must start
    // past x~190, not under/through the body copy column (which ends ~628).
    element = (
      <Canvas width={dims.w} height={dims.h} family="swineguardplus" format={format} origin={input.origin} original={input.original}>
        <Spacer height={430} />
        <TextBox value={`>> ${kicker}`.trim()} marginLeft={88} width={470} height={40} color="#7B1C21" family="Roboto" size={24} weight={500} lineHeight={1} />
        <Spacer height={10} />
        <Headline value={headline} marginLeft={88} width={532} height={300} color="#7B1C21" family="Roboto" size={64} weight={800} lineHeight={1.02} letterSpacing="-0.02em" />
        <Spacer height={45} />
        {/* The benefit icons below are baked into the locked background at a
            fixed y (~935), so this box must never push past that regardless
            of how long the generated body copy is — 3 lines max, not 4. */}
        <TextBox value={support} marginLeft={88} width={540} height={70} color="#2D3A43" family="Roboto" size={26} weight={400} lineHeight={1.3} />
        <Spacer height={40} />
        <TextBox value={fitted(input.fields.benefit_1, fits.benefit_1)} marginLeft={190} width={300} height={80} color="#22313B" family="Roboto" size={22} weight={700} lineHeight={1.16} />
        <Spacer height={35} />
        <TextBox value={fitted(input.fields.benefit_2, fits.benefit_2)} marginLeft={190} width={300} height={80} color="#22313B" family="Roboto" size={22} weight={700} lineHeight={1.16} />
        <Spacer height={35} />
        <TextBox value={fitted(input.fields.benefit_3, fits.benefit_3)} marginLeft={190} width={300} height={80} color="#22313B" family="Roboto" size={22} weight={700} lineHeight={1.16} />
        <Spacer height={110} />
        <SwineFlyerCta value={cta} marginLeft={88} width={900} />
        <Spacer height={15} />
        <TextBox value={contact} marginLeft={88} width={400} height={30} color="#0F4A2C" family="Roboto" size={24} weight={700} lineHeight={1} />
        <Spacer height={40} />
        <TextBox value={input.disclaimer} marginLeft={90} width={520} height={80} color="#777777" family="Roboto" size={18} weight={400} lineHeight={1.32} />
      </Canvas>
    );
  }

  return { element, ...dims };
}

export function renderTemplateSpec(input: RenderInput): RenderResult | null {
  const family = resolveFamily(input.layoutKey);
  if (!family) return null;

  const format = resolveFormat(input.sizeKey);
  if (family === "digestpro") return renderDigestPro(input, format);
  if (family === "caniguard5") return renderCaniGuard5(input, format);
  if (family === "poultryshieldpro") return renderPoultryShieldPro(input, format);
  return renderSwineGuardPlus(input, format);
}
