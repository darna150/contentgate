import { writeFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { renderTemplateSpec } from "../src/lib/template-spec-render";
import { renderPoultryShieldPro } from "../src/lib/poultryshieldpro-render";
import { loadPoultryShieldProFonts } from "../src/lib/poultryshieldpro-fonts";
import { renderSwineGuardPlus } from "../src/lib/swineguardplus-render";
import { loadSwineGuardPlusFonts } from "../src/lib/swineguardplus-fonts";
import { renderCaniGuard5 } from "../src/lib/caniguard5-render";
import { loadCaniGuard5Fonts } from "../src/lib/caniguard5-fonts";
import { renderDigestPro } from "../src/lib/digestpro-render";
import { loadDigestProFonts } from "../src/lib/digestpro-fonts";
import { renderVitalBite } from "../src/lib/vitalbite-render";
import { loadVitalBiteFonts } from "../src/lib/vitalbite-fonts";
import { renderApexCanine } from "../src/lib/apex-canine-render";
import { loadApexCanineFonts } from "../src/lib/apex-canine-fonts";
import type { SizeKey } from "../src/lib/creative";

const origin = "http://localhost:3001";

// Worst-case stress copy: every field gets MORE raw input than any
// configured max_chars/max_words/max_lines ceiling in the codebase, so each
// renderer's own fitCopy(...) call is what does the truncating — exactly
// what happens in production. If a box survives this, it survives anything
// shorter. Multi-line fields (headline, benefits) get a version with manual
// line breaks too, since AI-generated copy can come pre-broken.
const FILLER_WORDS =
  "consectetur adipiscing tellus pharetra magna fermentum iaculis eleifend nunc vestibulum dignissim accumsan posuere malesuada habitant".split(" ");

function filler(minChars: number): string {
  let out = "";
  let i = 0;
  while (out.length < minChars) {
    out += (out ? " " : "") + FILLER_WORDS[i % FILLER_WORDS.length];
    i++;
  }
  return out;
}

// 400 chars is comfortably past every max_chars ceiling in template-specs.ts
// and every inline fitCopy() call across the dedicated renderers (the
// largest is digestpro body at 260).
const STRESS = filler(400);
const STRESS_3LINE = ["Resilient gut.", "Efficient feed.", "Stronger herds and more."].join("\n") + "\n" + STRESS;
const STRESS_BENEFITS = [filler(60), filler(60), filler(60)].join("\n");

const STRESS_FIELDS: Record<string, string> = {
  kicker: STRESS,
  headline: STRESS_3LINE,
  supportCopy: STRESS,
  supporting: STRESS,
  body: STRESS,
  benefit_1: STRESS,
  benefit_2: STRESS,
  benefit_3: STRESS,
  benefits: STRESS_BENEFITS,
  bullets: STRESS_BENEFITS,
  cta: STRESS,
  contact: STRESS,
  tagline: STRESS,
  website: STRESS,
};

async function renderOne(
  name: string,
  layoutKey: string,
  sizeKey: SizeKey,
  fields: Record<string, string> = STRESS_FIELDS
) {
  let element;
  let w = 0;
  let h = 0;
  let fonts: any = undefined;

  if (layoutKey.startsWith("poultryshieldpro_")) {
    const r = renderTemplateSpec({ layoutKey, sizeKey, fields, disclaimer: filler(120), origin });
    if (!r) throw new Error("null spec render");
    element = r.element; w = r.w; h = r.h;
    fonts = await loadPoultryShieldProFonts();
  } else if (layoutKey.startsWith("swineguardplus_")) {
    const r = renderTemplateSpec({ layoutKey, sizeKey, fields, disclaimer: filler(120), origin });
    if (!r) throw new Error("null spec render");
    element = r.element; w = r.w; h = r.h;
    fonts = await loadSwineGuardPlusFonts();
  } else if (layoutKey.startsWith("caniguard5_")) {
    const r = renderCaniGuard5({ sizeKey, fields, disclaimer: filler(120), origin });
    element = r.element; w = r.w; h = r.h;
    fonts = await loadCaniGuard5Fonts();
  } else if (layoutKey.startsWith("digestpro_")) {
    const r = renderDigestPro({ sizeKey, fields, disclaimer: filler(120), origin });
    element = r.element; w = r.w; h = r.h;
    fonts = await loadDigestProFonts();
  } else if (layoutKey.startsWith("vitalbite_")) {
    const r = renderVitalBite({ layoutKey, sizeKey, fields, disclaimer: filler(120), origin });
    element = r.element; w = r.w; h = r.h;
    fonts = await loadVitalBiteFonts();
  } else if (layoutKey.startsWith("apex_canine_")) {
    const r = renderApexCanine({ sizeKey, fields, disclaimer: filler(120), origin });
    element = r.element; w = r.w; h = r.h;
    fonts = await loadApexCanineFonts();
  } else {
    throw new Error("unknown layout " + layoutKey);
  }

  const res = new ImageResponse(element as any, { width: w, height: h, fonts });
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(`/tmp/diffs/${name}.png`, buf);
  console.log(`wrote /tmp/diffs/${name}.png (${w}x${h})`);
}

async function main() {
  // PoultryShield Pro
  await renderOne("stress-poultry-square", "poultryshieldpro_social", "square");
  await renderOne("stress-poultry-story", "poultryshieldpro_social", "story");
  await renderOne("stress-poultry-feed", "poultryshieldpro_social", "feed");
  await renderOne("stress-poultry-flyer", "poultryshieldpro_flyer", "a4");

  // SwineGuard Plus
  await renderOne("stress-swine-square", "swineguardplus_social", "square");
  await renderOne("stress-swine-story", "swineguardplus_social", "story");
  await renderOne("stress-swine-feed", "swineguardplus_social", "feed");
  await renderOne("stress-swine-flyer", "swineguardplus_flyer", "a4");

  // CaniGuard 5
  await renderOne("stress-caniguard-square", "caniguard5_social", "square");
  await renderOne("stress-caniguard-story", "caniguard5_social", "story");
  await renderOne("stress-caniguard-feed", "caniguard5_feed", "feed");
  await renderOne("stress-caniguard-flyer", "caniguard5_flyer", "a4");

  // DigestPro
  await renderOne("stress-digestpro-square", "digestpro_social", "square");
  await renderOne("stress-digestpro-story", "digestpro_social", "story");
  await renderOne("stress-digestpro-flyer", "digestpro_flyer", "a4");
  await renderOne("stress-digestpro-presentation", "digestpro_presentation", "feed");

  // VitalBite
  await renderOne("stress-vitalbite-square", "vitalbite_square", "square");
  await renderOne("stress-vitalbite-story", "vitalbite_story", "story");
  await renderOne("stress-vitalbite-feed", "vitalbite_feed", "feed");
  await renderOne("stress-vitalbite-flyer", "vitalbite_flyer", "a4");

  // Apex Canine
  await renderOne("stress-apex-square", "apex_canine_social", "square");
  await renderOne("stress-apex-story", "apex_canine_social", "story");
  await renderOne("stress-apex-feed", "apex_canine_social", "feed");
  await renderOne("stress-apex-flyer", "apex_canine_flyer", "a4");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
