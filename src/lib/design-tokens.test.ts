import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

type ColorName = "white" | string;

type ContrastPair = {
  foreground: ColorName;
  background: ColorName;
  minimum: number;
  usage: string;
};

function token(name: ColorName) {
  if (name === "white") return "#ffffff";
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6});`));
  assert.ok(match, `Missing color token: ${name}`);
  return match[1];
}

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const PAIRS: ContrastPair[] = [
  { foreground: "white", background: "brand", minimum: 4.5, usage: "primary controls" },
  { foreground: "brand", background: "surface", minimum: 4.5, usage: "links and brand text" },
  { foreground: "white", background: "brand-strong", minimum: 4.5, usage: "primary hover controls" },
  { foreground: "brand-on-tint", background: "brand-tint", minimum: 4.5, usage: "tinted brand surfaces" },
  { foreground: "approve", background: "approve-tint", minimum: 4.5, usage: "approved status" },
  { foreground: "white", background: "approve", minimum: 4.5, usage: "approve controls" },
  { foreground: "warn", background: "warn-tint", minimum: 4.5, usage: "in-review status" },
  { foreground: "white", background: "warn", minimum: 4.5, usage: "warning controls" },
  { foreground: "reject", background: "reject-tint", minimum: 4.5, usage: "rejected status" },
  { foreground: "white", background: "reject", minimum: 4.5, usage: "destructive controls" },
  { foreground: "ink-muted", background: "surface", minimum: 4.5, usage: "secondary text on cards" },
  { foreground: "ink-muted", background: "page", minimum: 4.5, usage: "secondary text on pages" },
  { foreground: "ink-faint", background: "surface", minimum: 4.5, usage: "metadata on cards" },
  { foreground: "ink-faint", background: "page", minimum: 4.5, usage: "metadata on pages" },
  { foreground: "sidebar-faint", background: "brand-dark", minimum: 4.5, usage: "sidebar metadata" },
  { foreground: "edge-strong", background: "surface", minimum: 3, usage: "control borders on cards" },
  { foreground: "edge-strong", background: "page", minimum: 3, usage: "control borders on pages" },
  { foreground: "brand", background: "page", minimum: 3, usage: "focus outline on pages" },
  { foreground: "brand", background: "brand-dark", minimum: 3, usage: "focus outline in the sidebar" },
  { foreground: "brand-strong", background: "page", minimum: 4.5, usage: "small brand text on pages" },
];

test("documented color-token pairs meet their WCAG contrast thresholds", () => {
  for (const pair of PAIRS) {
    const actual = contrast(token(pair.foreground), token(pair.background));
    assert.ok(
      actual >= pair.minimum,
      `${pair.foreground} on ${pair.background} is ${actual.toFixed(3)}:1; ${pair.usage} requires ${pair.minimum}:1`,
    );
  }
});

test("accent tokens remain aliases of the accessible brand controls", () => {
  assert.equal(token("accent"), token("brand"));
  assert.equal(token("accent-dark"), token("brand-strong"));
});
