// Shared locked-layout renderer. Used by both the export route (real approved
// content) and the template-preview route (placeholder content). One design,
// one source of truth. Design is not user-editable.

type Fields = Record<string, string>;

const C = {
  from: "#12312B",
  to: "#0E5F58",
  text: "#FFFFFF",
  sub: "#C9DAD3",
  accent: "#A9D3C6",
  chipText: "#0B2520",
  disc: "#7E9A90",
};

function f(fields: Fields, key: string): string {
  return (fields[key] ?? "").toString().trim();
}

export function AssetLayout({
  layoutKey,
  fields,
  orgName,
  disclaimer,
  w,
  h,
}: {
  layoutKey: string;
  fields: Fields;
  orgName: string;
  disclaimer: string;
  w: number;
  h: number;
}): React.ReactElement {
  const m = Math.min(w, h);
  const pad = Math.round(m * 0.07);
  const benefits = [f(fields, "benefit_1"), f(fields, "benefit_2"), f(fields, "benefit_3")].filter(Boolean);

  function renderWordmark(small?: boolean) {
    const s = small ? m * 0.026 : m * 0.032;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: s * 0.5 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: s * 1.4,
            height: s * 1.4,
            borderRadius: s * 0.35,
            backgroundColor: C.accent,
            color: C.chipText,
            fontSize: s * 0.9,
            fontWeight: 800,
          }}
        >
          {orgName[0]}
        </div>
        <div style={{ display: "flex", fontSize: s, fontWeight: 800, letterSpacing: -s * 0.02 }}>
          {orgName}
        </div>
      </div>
    );
  }

  function renderApprovedPill() {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: m * 0.022,
          fontWeight: 800,
          letterSpacing: m * 0.004,
          color: C.chipText,
          backgroundColor: C.accent,
          borderRadius: 999,
          padding: `${Math.round(pad * 0.16)}px ${Math.round(pad * 0.32)}px`,
        }}
      >
        APPROVED
      </div>
    );
  }

  function renderDisclaimer() {
    if (!disclaimer) return <div style={{ display: "flex" }} />;
    return (
      <div style={{ display: "flex", fontSize: m * 0.019, lineHeight: 1.3, color: C.disc, maxWidth: "92%" }}>
        {disclaimer}
      </div>
    );
  }

  function renderBenefits(bs: number) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: bs * 0.5 }}>
        {benefits.map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: bs * 0.5 }}>
            <div
              style={{
                display: "flex",
                width: bs * 0.42,
                height: bs * 0.42,
                marginTop: bs * 0.4,
                borderRadius: bs * 0.12,
                backgroundColor: C.accent,
              }}
            />
            <div style={{ display: "flex", flex: 1, fontSize: bs, lineHeight: 1.25, color: C.text }}>{b}</div>
          </div>
        ))}
      </div>
    );
  }

  let inner: React.ReactElement;

  if (layoutKey === "flyer_v1") {
    const headlineSize = m * 0.072;
    inner = (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          {renderWordmark()}
          {renderApprovedPill()}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: pad * 0.4 }}>
          <div style={{ display: "flex", fontSize: headlineSize, fontWeight: 800, lineHeight: 1.04, letterSpacing: -headlineSize * 0.02 }}>
            {f(fields, "headline")}
          </div>
          {f(fields, "subheadline") && (
            <div style={{ display: "flex", fontSize: m * 0.034, color: C.sub, lineHeight: 1.3 }}>
              {f(fields, "subheadline")}
            </div>
          )}
        </div>
        {benefits.length > 0 && renderBenefits(m * 0.032)}
        {f(fields, "body") && (
          <div style={{ display: "flex", fontSize: m * 0.028, lineHeight: 1.5, color: C.sub }}>
            {f(fields, "body")}
          </div>
        )}
        {f(fields, "cta") && (
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              fontSize: m * 0.03,
              fontWeight: 700,
              color: C.chipText,
              backgroundColor: C.accent,
              borderRadius: pad * 0.3,
              padding: `${Math.round(pad * 0.24)}px ${Math.round(pad * 0.45)}px`,
            }}
          >
            {f(fields, "cta")}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: pad * 0.2, width: "100%", borderTop: `1px solid #1E4A41`, paddingTop: pad * 0.4 }}>
          {(f(fields, "contact") || f(fields, "territory")) && (
            <div style={{ display: "flex", fontSize: m * 0.022, color: C.sub }}>
              {[f(fields, "contact"), f(fields, "territory")].filter(Boolean).join("  ·  ")}
            </div>
          )}
          {renderDisclaimer()}
        </div>
      </div>
    );
  } else {
    const headlineSize = m * 0.092;
    const hasBenefits = benefits.length > 0;
    inner = (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          {renderWordmark(h < 1100)}
          {renderApprovedPill()}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: pad * 0.45 }}>
          <div style={{ display: "flex", fontSize: headlineSize, fontWeight: 800, lineHeight: 1.04, letterSpacing: -headlineSize * 0.02 }}>
            {f(fields, "headline")}
          </div>
          {hasBenefits ? (
            renderBenefits(m * 0.04)
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: pad * 0.35 }}>
              {f(fields, "body") && (
                <div style={{ display: "flex", fontSize: m * 0.038, lineHeight: 1.4, color: C.sub }}>
                  {f(fields, "body")}
                </div>
              )}
              {f(fields, "key_takeaway") && (
                <div style={{ display: "flex", fontSize: m * 0.042, fontWeight: 700, color: C.accent, lineHeight: 1.25 }}>
                  {f(fields, "key_takeaway")}
                </div>
              )}
            </div>
          )}
          {f(fields, "cta") && (
            <div style={{ display: "flex", fontSize: m * 0.034, fontWeight: 600, color: C.sub }}>
              {f(fields, "cta")}
            </div>
          )}
        </div>
        {renderDisclaimer()}
      </div>
    );
  }

  return (
    <div
      style={{
        width: w,
        height: h,
        display: "flex",
        padding: pad,
        backgroundImage: `linear-gradient(145deg, ${C.from}, ${C.to})`,
        fontFamily: "sans-serif",
        color: C.text,
      }}
    >
      {inner}
    </div>
  );
}
