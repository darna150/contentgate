import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { sliceGraphemes } from "../graphemes.ts";
import {
  calibrateTemplatePlatformFieldBudgets,
  templatePlatformFieldFitIssues,
} from "./fit.ts";
import type { TemplateBundleManifest } from "./manifest.ts";

const bundleRoot = join(
  process.cwd(),
  ".template-bundles",
  "nimbus-air-campaign"
);

async function loadBundle() {
  const manifest = JSON.parse(
    await readFile(join(bundleRoot, "manifest.json"), "utf8")
  ) as TemplateBundleManifest;
  const assetDataByPath = Object.fromEntries(
    await Promise.all(
      manifest.assets
        .filter((asset) => asset.kind === "font")
        .map(async (asset) => [asset.path, await readFile(join(bundleRoot, asset.path))] as const)
    )
  );
  return { manifest, assetDataByPath };
}

test("calibrates every Nimbus field independently for every Figma format", async () => {
  const { manifest, assetDataByPath } = await loadBundle();
  assert.equal(manifest.variants.length, 42);
  const capacities = new Set<number>();

  for (const variant of manifest.variants) {
    const textSlots = variant.slots.filter((slot) => slot.kind === "text");
    const budgets = await calibrateTemplatePlatformFieldBudgets({
      manifest,
      variantKey: variant.key,
      assetDataByPath,
    });
    assert.deepEqual(
      Object.keys(budgets).sort(),
      textSlots.map((slot) => slot.field).sort(),
      `${variant.key} did not calibrate every text field`
    );
    for (const slot of textSlots) {
      const budget = budgets[slot.field];
      assert.ok(budget.hardMaxChars > 0, `${variant.key}/${slot.field} has no hard maximum`);
      assert.equal(
        budget.generationTargetChars,
        Math.floor(budget.hardMaxChars * 0.85),
        `${variant.key}/${slot.field} does not use the 85% generation target`
      );
      capacities.add(budget.hardMaxChars);
    }

    const phrase = "Nimbus Air moves with clear proof and everyday comfort ".repeat(20);
    const fields = Object.fromEntries(
      textSlots.map((slot) => [
        slot.field,
        sliceGraphemes(phrase, 0, budgets[slot.field].generationTargetChars).trim(),
      ])
    );
    const issues = await templatePlatformFieldFitIssues({
      manifest,
      variantKey: variant.key,
      fields,
      assetDataByPath,
    });
    assert.deepEqual(issues, {}, `${variant.key} 85% target failed real glyph layout`);
  }

  assert.ok(capacities.size > 3, "all formats collapsed to the same character capacity");
});
