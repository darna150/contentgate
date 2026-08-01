import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

/*
 * Real generated OG image, not a placeholder — links to contentgate.app
 * previewed blank in Slack, LinkedIn, and iMessage until this existed.
 *
 * Rendered by Next's file convention, so no asset pipeline and no design
 * dependency. Deliberately austere: it has to survive being scaled to a 120px
 * thumbnail, so it carries the wordmark, one line, and nothing else.
 *
 * Palette is read off globals.css by hand — ImageResponse does not see the
 * app's Tailwind theme, so these hexes must be updated if the tokens move.
 */

export const alt =
  "ContentGate — You don’t need to be a marketer to market well.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#0a0a0a";
const TEAL_ON_DARK = "#00aa9f"; // --color-brand-on-dark; 6.84:1 on INK
const MUTED = "#a6a6a6"; // --color-sidebar-text; 8.1:1 on INK

export default async function OpengraphImage() {
  // ImageResponse cannot see the app's next/font setup, so Inter has to be
  // handed over as raw font data or every weight renders as a fallback sans at
  // regular. Read from disk rather than fetched — no network at build time.
  const [regular, bold] = await Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/Inter-Regular.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/Inter-Bold.ttf")),
  ]);

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: INK,
        padding: 72,
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 52,
            height: 52,
            borderRadius: 14,
            background: TEAL_ON_DARK,
            color: INK,
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          C
        </div>
        <div
          style={{
            color: "#ffffff",
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: "-0.03em",
          }}
        >
          contentgate
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            color: "#ffffff",
            fontSize: 78,
            fontWeight: 700,
            letterSpacing: "-0.035em",
            lineHeight: 1.03,
            maxWidth: 940,
          }}
        >
          You don’t need to be a marketer to market well.
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            color: MUTED,
            fontSize: 27,
          }}
        >
          <div
            style={{
              width: 5,
              height: 42,
              borderRadius: 3,
              background: TEAL_ON_DARK,
            }}
          />
          Approved claims in. On-brand, export-ready content out.
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Inter", data: regular, weight: 400, style: "normal" },
        { name: "Inter", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
