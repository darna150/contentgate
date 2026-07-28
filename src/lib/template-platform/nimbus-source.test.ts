import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

type NimbusFrameSource = {
  defaultBackgroundKey: string;
  defaultProductVariantKey: string;
  backgroundOptions: Array<{ key: string; label: string }>;
  productVariants: Array<{ key: string; label: string }>;
  frames: Array<{
    key: string;
    label: string;
    channel: string;
    figmaNodeId: string;
    width: number;
    height: number;
  }>;
};

async function loadSource() {
  const raw = await readFile(
    join(process.cwd(), "template-sources", "nimbus-air-campaign", "frames.json"),
    "utf8"
  );
  return JSON.parse(raw) as NimbusFrameSource;
}

test("Nimbus source keeps the full Figma frame inventory and picker defaults", async () => {
  const source = await loadSource();
  const frameKeys = new Set(source.frames.map((frame) => frame.key));

  assert.equal(source.defaultBackgroundKey, "sky");
  assert.equal(source.defaultProductVariantKey, "nimbus-1");
  assert.deepEqual(source.backgroundOptions.map((option) => option.key), ["sky"]);
  assert.deepEqual(source.productVariants.map((option) => option.key), ["nimbus-1"]);
  assert.equal(source.frames.length, 42);
  assert.equal(frameKeys.size, source.frames.length);

  for (const requiredKey of [
    "instagram-post-square",
    "instagram-story",
    "facebook-cover-photo",
    "x-banner",
    "linkedin-profile-banner",
    "youtube-thumbnail",
    "pinterest-pin-standard",
    "tiktok-post",
    "print-a4",
    "banner-ultrawide",
  ]) {
    assert.equal(frameKeys.has(requiredKey), true, `Expected ${requiredKey}`);
  }

  for (const frame of source.frames) {
    assert.match(frame.figmaNodeId, /^\d+:\d+$/);
    assert.equal(Number.isFinite(frame.width) && frame.width > 0, true);
    assert.equal(Number.isFinite(frame.height) && frame.height > 0, true);
  }
});
