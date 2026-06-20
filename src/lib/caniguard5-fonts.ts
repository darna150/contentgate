import { readFile } from "node:fs/promises";
import { join } from "node:path";

type CaniGuardFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700 | 800;
  style: "normal";
};

let fontPromise: Promise<CaniGuardFont[]> | null = null;

async function readPublicFont(filename: string): Promise<ArrayBuffer> {
  const buffer = await readFile(join(process.cwd(), "public", "fonts", filename));
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

export function loadCaniGuard5Fonts(): Promise<CaniGuardFont[]> {
  if (!fontPromise) {
    fontPromise = Promise.all([
      readPublicFont("Roboto-Regular.ttf"),
      readPublicFont("Roboto-Bold.ttf"),
      readPublicFont("Roboto-ExtraBold.ttf"),
    ]).then(([regular, bold, extraBold]) => [
      { name: "CaniGuard Roboto", data: regular, weight: 400, style: "normal" },
      { name: "CaniGuard Roboto", data: bold, weight: 700, style: "normal" },
      { name: "CaniGuard Roboto", data: extraBold, weight: 800, style: "normal" },
    ]);
  }
  return fontPromise;
}
