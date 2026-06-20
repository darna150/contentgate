import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ImageResponse } from "next/og";
import { renderTemplateSpec } from "../src/lib/template-spec-render";
import { renderPoultryShieldPro } from "../src/lib/poultryshieldpro-render";
import { loadPoultryShieldProFonts } from "../src/lib/poultryshieldpro-fonts";
import { renderSwineGuardPlus } from "../src/lib/swineguardplus-render";
import { loadSwineGuardPlusFonts } from "../src/lib/swineguardplus-fonts";
import {
  caniGuard5LayoutDensity,
  renderCaniGuard5,
} from "../src/lib/caniguard5-render";
import { loadCaniGuard5Fonts } from "../src/lib/caniguard5-fonts";
import { renderDigestPro } from "../src/lib/digestpro-render";
import { loadDigestProFonts } from "../src/lib/digestpro-fonts";
import {
  vitalBiteLayoutDensity,
  renderVitalBite,
} from "../src/lib/vitalbite-render";
import { loadVitalBiteFonts } from "../src/lib/vitalbite-fonts";
import {
  apexCanineLayoutDensity,
  renderApexCanine,
} from "../src/lib/apex-canine-render";
import { loadApexCanineFonts } from "../src/lib/apex-canine-fonts";
import type { SizeKey } from "../src/lib/creative";

const origin = "http://localhost:3000";

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

  // CaniGuard 5 (square only — new Canva campaign 2026-06)
  await renderOne("stress-caniguard-square", "caniguard5_social", "square");
  const caniShort = {
    headline: "One vaccine.\nTotal confidence.",
    supportCopy: "Clinically proven core protection.",
  };
  const caniStandard = {
    headline: "One vaccine.\nFive diseases.\nTotal confidence.",
    supportCopy: "Clinically proven protection against distemper, parvovirus, adenovirus, and parainfluenza.",
  };
  const caniLong = {
    headline: "Complete five-in-one canine.\nCore protection.\nClinically proven confidence.",
    supportCopy: "Clinically proven protection against distemper, parvovirus, adenovirus type 2, parainfluenza, and leptospirosis.",
  };
  assert.equal(caniGuard5LayoutDensity(caniShort), "short");
  assert.equal(caniGuard5LayoutDensity(caniStandard), "standard");
  assert.equal(caniGuard5LayoutDensity(caniLong), "long");
  await renderOne("adaptive-short-caniguard-square", "caniguard5_social", "square", caniShort);
  await renderOne("adaptive-standard-caniguard-square", "caniguard5_social", "square", caniStandard);
  await renderOne("adaptive-long-caniguard-square", "caniguard5_social", "square", caniLong);

  // VitalBite (square only — new Canva campaign 2026-06)
  await renderOne("stress-vitalbite-square", "vitalbite_social", "square");
  const vbShort = {
    kicker: "Dental wellness",
    headline: "Fresher breath.\nHappier dogs.",
    supporting: "Grain-free daily chews.",
    cta: "Shop now.",
  };
  const vbStandard = {
    kicker: "Clinically tested dental wellness",
    headline: "Fresher breath.\nCleaner teeth.\nHappier dogs.",
    supporting: "Grain-free treats with natural ingredients for dogs of all sizes.",
    cta: "Discover VitalBite.",
  };
  const vbLong = {
    kicker: "Veterinarian-recommended dental wellness for dogs",
    headline: "Fresher breath.\nCleaner teeth.\nHappier, healthier dogs.",
    supporting: "Grain-free dental chews with natural ingredients clinically tested for dogs of all breeds and sizes.",
    cta: "Discover VitalBite today.",
  };
  assert.equal(vitalBiteLayoutDensity(vbShort), "short");
  assert.equal(vitalBiteLayoutDensity(vbStandard), "standard");
  assert.equal(vitalBiteLayoutDensity(vbLong), "long");
  await renderOne("adaptive-short-vitalbite-square", "vitalbite_social", "square", vbShort);
  await renderOne("adaptive-standard-vitalbite-square", "vitalbite_social", "square", vbStandard);
  await renderOne("adaptive-long-vitalbite-square", "vitalbite_social", "square", vbLong);

  // DigestPro
  await renderOne("stress-digestpro-square", "digestpro_social", "square");
  await renderOne("stress-digestpro-story", "digestpro_social", "story");
  await renderOne("stress-digestpro-flyer", "digestpro_flyer", "a4");
  await renderOne("stress-digestpro-presentation", "digestpro_presentation", "feed");

  // Apex Canine
  await renderOne("stress-apex-square", "apex_canine_social", "square");
  await renderOne("stress-apex-story", "apex_canine_social", "story");
  await renderOne("stress-apex-flyer", "apex_canine_flyer", "a4");
  const apexShortSocial = {
    kicker: "Daily nutrition",
    headline: "Good health starts here.",
    supportCopy: "Real chicken. Daily support.",
    cta: "Discover Apex",
  };
  const apexStandardSocial = {
    kicker: "Veterinarian-formulated nutrition",
    headline: "Balanced nutrition for adult dogs.",
    supportCopy: "Real chicken with daily support.",
    cta: "Discover Apex Canine",
  };
  const apexSocial = {
    kicker: "Veterinarian-formulated adult nutrition",
    headline: "Complete daily nutrition for healthier dogs.",
    supportCopy: "Real chicken with digestive, skin and coat support.",
    cta: "Discover Apex Canine",
  };
  assert.equal(apexCanineLayoutDensity("square", apexShortSocial), "short");
  assert.equal(apexCanineLayoutDensity("square", apexStandardSocial), "standard");
  assert.equal(apexCanineLayoutDensity("square", apexSocial), "long");
  await renderOne("adaptive-short-apex-square", "apex_canine_social", "square", apexShortSocial);
  await renderOne("adaptive-standard-apex-square", "apex_canine_social", "square", apexStandardSocial);
  await renderOne("reference-apex-square", "apex_canine_social", "square", apexSocial);
  await renderOne("adaptive-short-apex-story", "apex_canine_social", "story", apexShortSocial);
  await renderOne("adaptive-standard-apex-story", "apex_canine_social", "story", apexStandardSocial);
  await renderOne("reference-apex-story", "apex_canine_social", "story", apexSocial);
  await renderOne("reported-overlap-apex-story", "apex_canine_social", "story", {
    kicker: "Veterinarian-formulated nutrition",
    headline: "Complete, AAFCO-balanced adult care",
    supportCopy: "Real chicken, joint, digestive and coat support.",
    cta: "Recommend Apex Canine",
  });
  const apexShortFlyer = {
    kicker: "Everyday adult nutrition",
    headline: "Healthy starts daily.",
    body: "Real chicken and balanced everyday support for adult dogs.",
  };
  const apexStandardFlyer = {
    kicker: "Veterinarian-formulated adult nutrition",
    headline: "Balanced nutrition for adult dogs.",
    body: "A balanced formula made with real chicken to support healthy digestion, skin, coat, and everyday vitality.",
  };
  const apexLongFlyer = {
    kicker: "Veterinarian-formulated adult nutrition",
    headline: "Complete daily nutrition for healthier dogs.",
    body: "A thoughtfully crafted adult dog nutrition formula made with real chicken and targeted support for digestion, skin, coat, and everyday vitality.",
  };
  assert.equal(apexCanineLayoutDensity("a4", apexShortFlyer), "short");
  assert.equal(apexCanineLayoutDensity("a4", apexStandardFlyer), "standard");
  assert.equal(apexCanineLayoutDensity("a4", apexLongFlyer), "long");
  await renderOne("adaptive-short-apex-flyer", "apex_canine_flyer", "a4", apexShortFlyer);
  await renderOne("adaptive-standard-apex-flyer", "apex_canine_flyer", "a4", apexStandardFlyer);
  await renderOne("reference-apex-flyer", "apex_canine_flyer", "a4", apexLongFlyer);
  await renderOne("reported-overlap-apex-flyer", "apex_canine_flyer", "a4", {
    kicker: "Adult dog nutrition explained",
    headline: "Understanding complete and balanced nutrition",
    body: "Apex Canine is a complete, balanced food meeting AAFCO standards for adult dogs, made with real chicken first, plus prebiotic fiber and live probiotic cultures.",
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
