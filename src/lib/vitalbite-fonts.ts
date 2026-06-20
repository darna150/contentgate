import { readFile } from "node:fs/promises";
import { join } from "node:path";

type VitalBiteFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 700 | 800;
  style: "normal";
};

let fontPromise: Promise<VitalBiteFont[]> | null = null;

async function readPublicFont(filename: string): Promise<ArrayBuffer> {
  const buffer = await readFile(join(process.cwd(), "public", "fonts", filename));
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

export function loadVitalBiteFonts(): Promise<VitalBiteFont[]> {
  if (!fontPromise) {
    fontPromise = Promise.all([
      readPublicFont("NunitoSans-Regular.ttf"),
      readPublicFont("NunitoSans-SemiBold.ttf"),
      readPublicFont("NunitoSans-Bold.ttf"),
      readPublicFont("NunitoSans-ExtraBold.ttf"),
    ]).then(([regular, semi, bold, extra]) => [
      { name: "VitalBite Nunito Sans", data: regular, weight: 400, style: "normal" },
      { name: "VitalBite Nunito Sans", data: semi, weight: 500, style: "normal" },
      { name: "VitalBite Nunito Sans", data: bold, weight: 700, style: "normal" },
      { name: "VitalBite Nunito Sans", data: extra, weight: 800, style: "normal" },
    ]);
  }
  return fontPromise;
}
