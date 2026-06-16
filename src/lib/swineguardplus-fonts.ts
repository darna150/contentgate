import { readFile } from "node:fs/promises";
import { join } from "node:path";

type SGPFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 700 | 800;
  style: "normal";
};

let fontPromise: Promise<SGPFont[]> | null = null;

async function readPublicFont(filename: string): Promise<ArrayBuffer> {
  const buffer = await readFile(join(process.cwd(), "public", "fonts", filename));
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

export function loadSwineGuardPlusFonts(): Promise<SGPFont[]> {
  if (!fontPromise) {
    fontPromise = Promise.all([
      readPublicFont("Roboto-Regular.ttf"),
      readPublicFont("Roboto-Medium.ttf"),
      readPublicFont("Roboto-Bold.ttf"),
      readPublicFont("Roboto-ExtraBold.ttf"),
    ]).then(([regular, medium, bold, extraBold]) => [
      { name: "Roboto", data: regular, weight: 400, style: "normal" },
      { name: "Roboto", data: medium, weight: 500, style: "normal" },
      { name: "Roboto", data: bold, weight: 700, style: "normal" },
      { name: "Roboto", data: extraBold, weight: 800, style: "normal" },
    ]);
  }
  return fontPromise;
}
