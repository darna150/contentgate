import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { convertServerRenderedPng } from "./server-export-formats.ts";

async function samplePng() {
  const buffer = await sharp({
    create: {
      width: 120,
      height: 63,
      channels: 4,
      background: "#0e3b34",
    },
  })
    .png()
    .toBuffer();
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

test("keeps server-rendered PNG bytes downloadable", async () => {
  const png = await samplePng();
  const output = await convertServerRenderedPng({
    png,
    width: 120,
    height: 63,
    size: "link_ad",
    format: "png",
  });

  assert.equal(output.contentType, "image/png");
  assert.equal(output.extension, "png");
  assert.deepEqual([...output.body.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test("converts server-rendered PNG to JPEG", async () => {
  const output = await convertServerRenderedPng({
    png: await samplePng(),
    width: 120,
    height: 63,
    size: "link_ad",
    format: "jpeg",
  });

  assert.equal(output.contentType, "image/jpeg");
  assert.equal(output.extension, "jpg");
  assert.deepEqual([...output.body.slice(0, 3)], [255, 216, 255]);
});

test("wraps server-rendered JPEG bytes in a one-page PDF", async () => {
  const output = await convertServerRenderedPng({
    png: await samplePng(),
    width: 120,
    height: 63,
    size: "link_ad",
    format: "pdf",
  });

  assert.equal(output.contentType, "application/pdf");
  assert.equal(output.extension, "pdf");
  assert.equal(new TextDecoder().decode(output.body.slice(0, 8)), "%PDF-1.4");
});
