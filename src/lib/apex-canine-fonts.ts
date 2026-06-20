import { readFile } from "node:fs/promises";
import { join } from "node:path";

type ApexFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
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
      readPublicFont("Fraunces9pt-Bold.otf"),
      readPublicFont("Nourd-Regular.otf"),
      readPublicFont("Nourd-Bold.otf"),
    ]).then(([fraunces, nourdRegular, nourdBold]) => [
      { name: "Apex Fraunces", data: fraunces, weight: 700, style: "normal" },
      { name: "Apex Nourd", data: nourdRegular, weight: 400, style: "normal" },
      { name: "Apex Nourd", data: nourdBold, weight: 700, style: "normal" },
    ]);
  }

  return fontPromise;
}
