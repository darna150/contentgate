import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function token(name: string) {
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
      channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test("functional text color tokens meet AA contrast on their surfaced backgrounds", () => {
  const pairs: Array<[string, string]> = [
    ["brand", "surface"],
    ["brand", "brand-tint"],
    ["approve", "approve-tint"],
    ["warn", "warn-tint"],
    ["reject", "reject-tint"],
    ["ink-muted", "surface"],
    ["ink-faint", "surface"],
  ];

  for (const [foreground, background] of pairs) {
    assert.ok(
      contrast(token(foreground), token(background)) >= 4.5,
      `${foreground} on ${background} must meet 4.5:1 contrast`,
    );
  }
});

test("white text meets AA contrast on filled functional controls", () => {
  for (const background of ["brand", "approve", "reject", "warn"]) {
    assert.ok(
      contrast("#ffffff", token(background)) >= 4.5,
      `white on ${background} must meet 4.5:1 contrast`,
    );
  }
});
