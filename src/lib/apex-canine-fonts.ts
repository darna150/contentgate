import { readFile } from "node:fs/promises";
import { join } from "node:path";

type ApexFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600 | 700 | 800;
  style: "normal";
};

let fontPromise: Promise<ApexFont[]> | null = null;

async function readPublicFont(filename: string): Promise<ArrayBuffer> {
  const buffer = await readFile(join(process.cwd(), "public", "fonts", filename));
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

export function loadApexCanineFonts(): Promise<ApexFont[]> {
  if (!fontPromise) {
    fontPromise = Promise.all([
      readPublicFont("Fraunces-Bold.ttf"),
      readPublicFont("NunitoSans-Regular.ttf"),
      readPublicFont("NunitoSans-SemiBold.ttf"),
      readPublicFont("NunitoSans-Bold.ttf"),
      readPublicFont("NunitoSans-ExtraBold.ttf"),
    ]).then(([fraunces, nunitoRegular, nunitoSemiBold, nunitoBold, nunitoExtraBold]) => [
      { name: "Fraunces", data: fraunces, weight: 700, style: "normal" },
      { name: "Nunito Sans", data: nunitoRegular, weight: 400, style: "normal" },
      { name: "Nunito Sans", data: nunitoSemiBold, weight: 600, style: "normal" },
      { name: "Nunito Sans", data: nunitoBold, weight: 700, style: "normal" },
      { name: "Nunito Sans", data: nunitoExtraBold, weight: 800, style: "normal" },
    ]);
  }

  return fontPromise;
}
