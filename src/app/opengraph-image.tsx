import { ImageResponse } from "next/og";

export const alt = "ContentGate — governed marketing production";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background: "#0a0a0a",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: "72px 80px",
        width: "100%",
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: 18 }}>
        <div
          style={{
            alignItems: "center",
            background: "#007a74",
            borderRadius: 18,
            display: "flex",
            fontSize: 38,
            fontWeight: 800,
            height: 64,
            justifyContent: "center",
            width: 64,
          }}
        >
          C
        </div>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>
          contentgate
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ color: "#00aa9f", display: "flex", fontSize: 24, fontWeight: 700 }}>
          GOVERNED MARKETING PRODUCTION
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 68,
            fontWeight: 800,
            letterSpacing: "-2px",
            lineHeight: 1.05,
            maxWidth: 980,
          }}
        >
          You don’t need to be a marketer to market well.
        </div>
      </div>

      <div style={{ color: "#c7c7c7", display: "flex", fontSize: 26 }}>
        Approved knowledge in. Compliant content out.
      </div>
    </div>,
    size,
  );
}
