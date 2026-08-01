import assert from "node:assert/strict";
import test from "node:test";

import {
  calibrateTemplatePlatformFieldBudgets,
  coerceTemplatePlatformFieldsToFit,
  resolveTemplatePlatformTextSlotLayout,
  resolveTemplatePlatformVariantLayout,
  templatePlatformFieldFitIssues,
} from "./fit.ts";
import { graphemeCount } from "../graphemes.ts";
import type { TemplateBundleManifest, TemplateBundleTextSlot } from "./manifest.ts";
import { validTemplateBundleManifest } from "./test-fixtures.ts";

// square/headline-slot: fontSize 72, minFontSize 56, width 760, height 160,
// maxLines 2, fit "shrink_to_fit" — real Inter-Bold.ttf resolves from
// public/fonts/ (see server-fonts.ts's readPublicFontAsset fallback).
const manifest = validTemplateBundleManifest;
const headlineSlot = manifest.variants[0].slots.find(
  (slot): slot is TemplateBundleTextSlot => slot.kind === "text" && slot.field === "headline"
)!;

function fixedManifest(): TemplateBundleManifest {
  return {
    ...manifest,
    variants: [
      {
        ...manifest.variants[0],
        slots: manifest.variants[0].slots.map((slot) =>
          slot.kind === "text" ? { ...slot, fit: "fixed" as const } : slot
        ),
      },
    ],
  };
}

// Long enough that it wraps past 2 lines at fontSize 72 in a 760px-wide box,
// but short enough to fit at some size >= minFontSize (56).
const overflowsAtMaxOnly = "Approved local marketing copy for every team";
// Long enough that it fails to fit even at minFontSize (56).
const overflowsEvenAtMin =
  "This headline is deliberately far too long to ever fit inside a locked two line headline box no matter how small the font gets rendered";

test("calibrates a format-specific hard maximum from actual font and slot geometry", async () => {
  const budgets = await calibrateTemplatePlatformFieldBudgets({
    manifest,
    variantKey: "square",
  });
  const budget = budgets.headline;
  assert.ok(budget.hardMaxChars > 0);
  assert.ok(budget.geometryCapacityChars > 0);
  assert.equal(
    budget.generationTargetChars,
    Math.floor(budget.hardMaxChars * 0.85)
  );
  assert.equal(budget.width, headlineSlot.width);
  assert.equal(budget.height, headlineSlot.height);
  assert.equal(budget.minFontSize, headlineSlot.minFontSize);
});

test("authored caps can tighten but geometry-derived caches cannot override calibration", async () => {
  const authored: TemplateBundleManifest = {
    ...manifest,
    variants: manifest.variants.map((variant) => ({
      ...variant,
      slots: variant.slots.map((slot) =>
        slot.kind === "text"
          ? { ...slot, maxChars: 12, maxCharsSource: "authored" as const }
          : slot
      ),
    })),
  };
  const geometry: TemplateBundleManifest = {
    ...authored,
    variants: authored.variants.map((variant) => ({
      ...variant,
      slots: variant.slots.map((slot) =>
        slot.kind === "text"
          ? { ...slot, maxChars: 2, maxCharsSource: "geometry" as const }
          : slot
      ),
    })),
  };
  const authoredBudget = await calibrateTemplatePlatformFieldBudgets({
    manifest: authored,
    variantKey: "square",
  });
  const geometryBudget = await calibrateTemplatePlatformFieldBudgets({
    manifest: geometry,
    variantKey: "square",
  });
  assert.equal(authoredBudget.headline.hardMaxChars, 12);
  assert.ok(geometryBudget.headline.hardMaxChars > 2);
});

test("shrink_to_fit resolves a smaller font size for copy that overflows the authored size", async () => {
  const atMax = await resolveTemplatePlatformTextSlotLayout(manifest, "Short headline", headlineSlot);
  assert.equal(atMax.fits, true);
  assert.equal(atMax.fontSize, headlineSlot.fontSize);

  const shrunk = await resolveTemplatePlatformTextSlotLayout(manifest, overflowsAtMaxOnly, headlineSlot);
  assert.equal(shrunk.fits, true);
  assert.ok(shrunk.fontSize < headlineSlot.fontSize, "expected a smaller font size than authored");
  assert.ok(shrunk.fontSize >= headlineSlot.minFontSize!, "must not shrink past minFontSize");
  assert.ok(shrunk.lines.length <= headlineSlot.maxLines);
});

test("shrink_to_fit falls back to minFontSize and reports fits:false when nothing in range fits", async () => {
  const result = await resolveTemplatePlatformTextSlotLayout(manifest, overflowsEvenAtMin, headlineSlot);
  assert.equal(result.fits, false);
  assert.equal(result.fontSize, headlineSlot.minFontSize);
});

test('"fixed" slots never shrink, even when shrinking would make the copy fit', async () => {
  const fixed = fixedManifest();
  const fixedSlot = fixed.variants[0].slots.find(
    (slot): slot is TemplateBundleTextSlot => slot.kind === "text" && slot.field === "headline"
  )!;
  const result = await resolveTemplatePlatformTextSlotLayout(fixed, overflowsAtMaxOnly, fixedSlot);
  assert.equal(result.fontSize, fixedSlot.fontSize);
  assert.equal(result.fits, false, "fixed slots must still report the overflow, not silently clip");
});

test("resolveTemplatePlatformVariantLayout resolves every text slot of a variant, keyed by field", async () => {
  const layout = await resolveTemplatePlatformVariantLayout({
    manifest,
    variantKey: "square",
    fields: { headline: overflowsAtMaxOnly },
  });
  assert.deepEqual(Object.keys(layout), ["headline"]);
  assert.ok(layout.headline.fontSize < headlineSlot.fontSize);
});

test("templatePlatformFieldFitIssues no longer flags copy that a shrink_to_fit slot can still hold", async () => {
  const issues = await templatePlatformFieldFitIssues({
    manifest,
    variantKey: "square",
    fields: { headline: overflowsAtMaxOnly },
  });
  assert.deepEqual(issues.headline ?? [], []);
});

test("templatePlatformFieldFitIssues still flags copy no size in range can hold", async () => {
  const issues = await templatePlatformFieldFitIssues({
    manifest,
    variantKey: "square",
    fields: { headline: overflowsEvenAtMin },
  });
  assert.ok((issues.headline ?? []).length > 0);
});

test("coerceTemplatePlatformFieldsToFit shrinks before truncating", async () => {
  const result = await coerceTemplatePlatformFieldsToFit({
    manifest,
    variantKey: "square",
    fields: { headline: overflowsAtMaxOnly },
  });
  // Shrinking alone resolves it, so the stored copy must be untouched —
  // this is the behavior QA previously flagged as "copy incomplete because
  // it was being forced too hard to fit."
  assert.equal(result.fields.headline, overflowsAtMaxOnly);
  assert.deepEqual(result.truncatedFields, []);
});

test("coerceTemplatePlatformFieldsToFit still trims when even minFontSize can't hold the copy", async () => {
  const result = await coerceTemplatePlatformFieldsToFit({
    manifest,
    variantKey: "square",
    fields: { headline: overflowsEvenAtMin },
  });
  assert.ok(result.fields.headline.length < overflowsEvenAtMin.length);
  const resolved = await resolveTemplatePlatformTextSlotLayout(manifest, result.fields.headline, headlineSlot);
  assert.equal(resolved.fits, true);
  assert.deepEqual(result.truncatedFields, ["headline"]);
});

test("coerceTemplatePlatformFieldsToFit keeps character-limit truncation on word boundaries", async () => {
  const constrained: TemplateBundleManifest = {
    ...manifest,
    variants: [
      {
        ...manifest.variants[0],
        slots: manifest.variants[0].slots.map((slot) =>
          slot.kind === "text" ? { ...slot, maxChars: 18 } : slot
        ),
      },
    ],
  };
  const result = await coerceTemplatePlatformFieldsToFit({
    manifest: constrained,
    variantKey: "square",
    fields: { headline: "Cloud-soft cushioning meets real-world speed" },
  });

  assert.equal(result.fields.headline, "Cloud-soft");
  assert.equal(result.fields.headline.length <= 18, true);
  assert.deepEqual(result.truncatedFields, ["headline"]);
});

test("coercion never splits a visible grapheme", async () => {
  const constrained: TemplateBundleManifest = {
    ...manifest,
    variants: [
      {
        ...manifest.variants[0],
        slots: manifest.variants[0].slots.map((slot) =>
          slot.kind === "text" ? { ...slot, maxChars: 3 } : slot
        ),
      },
    ],
  };
  const result = await coerceTemplatePlatformFieldsToFit({
    manifest: constrained,
    variantKey: "square",
    fields: { headline: "A👩‍💻B approved" },
  });
  assert.ok(graphemeCount(result.fields.headline) <= 3);
  assert.equal(result.fields.headline.includes("�"), false);
});

test("coercion removes a dangling connector created by truncation", async () => {
  const constrained: TemplateBundleManifest = {
    ...manifest,
    variants: [
      {
        ...manifest.variants[0],
        slots: manifest.variants[0].slots.map((slot) =>
          slot.kind === "text" ? { ...slot, maxChars: 24 } : slot
        ),
      },
    ],
  };
  const result = await coerceTemplatePlatformFieldsToFit({
    manifest: constrained,
    variantKey: "square",
    fields: { headline: "Cloud cushioning built for everyday speed" },
  });

  assert.equal(result.fields.headline, "Cloud cushioning built");
  assert.deepEqual(result.truncatedFields, ["headline"]);
});

test("coercion removes punctuation that implies truncated copy continues", async () => {
  const constrained: TemplateBundleManifest = {
    ...manifest,
    variants: [
      {
        ...manifest.variants[0],
        slots: manifest.variants[0].slots.map((slot) =>
          slot.kind === "text" ? { ...slot, maxChars: 17 } : slot
        ),
      },
    ],
  };
  const result = await coerceTemplatePlatformFieldsToFit({
    manifest: constrained,
    variantKey: "square",
    fields: { headline: "Cloud cushioning, ready for every road" },
  });

  assert.equal(result.fields.headline, "Cloud cushioning");
  assert.deepEqual(result.truncatedFields, ["headline"]);
});
