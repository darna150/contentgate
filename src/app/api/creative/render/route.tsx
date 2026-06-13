import { ImageResponse } from "next/og";
import { SIZES, BACKGROUNDS, DEFAULTS, type SizeKey } from "@/lib/creative";

export const runtime = "nodejs";

// Renders a designed marketing asset to a PNG at the requested channel size.
// One parametric template for now; the gallery adds more in Phase 2.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const sizeKey = (searchParams.get("size") ?? DEFAULTS.size) as SizeKey;
  const size = SIZES[sizeKey] ?? SIZES[DEFAULTS.size];
  const bg = BACKGROUNDS[searchParams.get("bg") ?? DEFAULTS.bg] ?? BACKGROUNDS.forest;

  const org = searchParams.get("org") ?? DEFAULTS.org;
  const headline = searchParams.get("headline") ?? DEFAULTS.headline;
  const cta = searchParams.get("cta") ?? DEFAULTS.cta;
  const price = searchParams.get("price") ?? DEFAULTS.price;
  const disclaimer = searchParams.get("disclaimer") ?? DEFAULTS.disclaimer;
  const img = searchParams.get("img") ?? "";
  const approved = (searchParams.get("approved") ?? "1") === "1";

  const { w, h } = size;
  const m = Math.min(w, h);
  const pad = Math.round(m * 0.075);
  const headlineSize = Math.round(m * 0.092);
  const ctaSize = Math.round(m * 0.04);
  const labelSize = Math.round(m * 0.03);
  const priceSize = Math.round(m * 0.05);
  const discSize = Math.round(m * 0.024);
  const radius = Math.round(m * 0.03);
  const wide = w / h > 1.4; // feed banner

  const hasImg = /^https?:\/\//.test(img);

  return new ImageResponse(
    (
      <div
        style={{
          width: w,
          height: h,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: pad,
          backgroundImage: `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`,
          fontFamily: "sans-serif",
          color: bg.text,
        }}
      >
        {/* Top row: brand + approved badge */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: labelSize,
              fontWeight: 700,
              letterSpacing: labelSize * 0.12,
              textTransform: "uppercase",
            }}
          >
            {org}
          </div>
          {approved && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: labelSize * 0.82,
                fontWeight: 700,
                color: bg.chipText,
                backgroundColor: bg.chipBg,
                borderRadius: 999,
                padding: `${Math.round(pad * 0.18)}px ${Math.round(pad * 0.34)}px`,
              }}
            >
              APPROVED
            </div>
          )}
        </div>

        {/* Middle: optional product image + headline */}
        <div
          style={{
            display: "flex",
            flexDirection: wide ? "row" : "column",
            alignItems: wide ? "center" : "flex-start",
            gap: pad * 0.6,
            width: "100%",
          }}
        >
          {hasImg && (
            <img
              src={img}
              width={wide ? Math.round(w * 0.4) : Math.round(w - pad * 2)}
              height={wide ? Math.round(h - pad * 2) : Math.round(h * 0.34)}
              style={{
                objectFit: "cover",
                borderRadius: radius,
              }}
            />
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: headlineSize,
                fontWeight: 800,
                lineHeight: 1.04,
                letterSpacing: -headlineSize * 0.02,
              }}
            >
              {headline}
            </div>
            {cta ? (
              <div
                style={{
                  display: "flex",
                  marginTop: pad * 0.4,
                  fontSize: ctaSize,
                  fontWeight: 600,
                  color: bg.sub,
                }}
              >
                {cta}
              </div>
            ) : (
              <div style={{ display: "flex" }} />
            )}
          </div>
        </div>

        {/* Bottom: disclaimer + price chip */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              maxWidth: "62%",
              fontSize: discSize,
              color: bg.sub,
              lineHeight: 1.3,
            }}
          >
            {disclaimer}
          </div>
          {price ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: priceSize,
                fontWeight: 800,
                color: bg.chipText,
                backgroundColor: bg.chipBg,
                borderRadius: radius,
                padding: `${Math.round(pad * 0.22)}px ${Math.round(pad * 0.4)}px`,
              }}
            >
              {price}
            </div>
          ) : (
            <div style={{ display: "flex" }} />
          )}
        </div>
      </div>
    ),
    { width: w, height: h }
  );
}
