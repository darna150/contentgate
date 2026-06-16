import { readFile } from "node:fs/promises";
import { join } from "node:path";

type DigestProFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600 | 700 | 800;
  style: "normal";
};

let fontPromise: Promise<DigestProFont[]> | null = null;

async function readPublicFont(filename: string): Promise<ArrayBuffer> {
  const buffer = await readFile(join(process.cwd(), "public", "fonts", filename));
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

export function loadDigestProFonts(): Promise<DigestProFont[]> {
  if (!fontPromise) {
    fontPromise = Promise.all([
      readPublicFont("Fraunces-Bold.ttf"),
      readPublicFont("BreeSerif-Regular.ttf"),
      readPublicFont("NunitoSans-Regular.ttf"),
      readPublicFont("NunitoSans-SemiBold.ttf"),
      readPublicFont("NunitoSans-Bold.ttf"),
      readPublicFont("NunitoSans-ExtraBold.ttf"),
    ]).then(([frauncesBold, breeRegular, nunitoRegular, nunitoSemi, nunitoBold, nunitoExtra]) => [
      { name: "Fraunces", data: frauncesBold, weight: 800, style: "normal" },
      { name: "Bree Serif", data: breeRegular, weight: 400, style: "normal" },
      { name: "Nunito Sans", data: nunitoRegular, weight: 400, style: "normal" },
      { name: "Nunito Sans", data: nunitoSemi, weight: 600, style: "normal" },
      { name: "Nunito Sans", data: nunitoBold, weight: 700, style: "normal" },
      { name: "Nunito Sans", data: nunitoExtra, weight: 800, style: "normal" },
    ]);
  }

  return fontPromise;
}
