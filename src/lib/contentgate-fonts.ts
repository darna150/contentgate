import { readFile } from "node:fs/promises";
import { join } from "node:path";

type ContentGateFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600 | 700 | 800;
  style: "normal";
};

let fontPromise: Promise<ContentGateFont[]> | null = null;

async function readPublicFont(filename: string): Promise<ArrayBuffer> {
  const buffer = await readFile(join(process.cwd(), "public", "fonts", filename));
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

export function loadContentGateFonts(): Promise<ContentGateFont[]> {
  if (!fontPromise) {
    fontPromise = Promise.all([
      readPublicFont("NunitoSans-Regular.ttf"),
      readPublicFont("NunitoSans-SemiBold.ttf"),
      readPublicFont("NunitoSans-Bold.ttf"),
      readPublicFont("NunitoSans-ExtraBold.ttf"),
    ]).then(([regular, semi, bold, extra]) => [
      { name: "ContentGate Sans", data: regular, weight: 400, style: "normal" },
      { name: "ContentGate Sans", data: semi, weight: 600, style: "normal" },
      { name: "ContentGate Sans", data: bold, weight: 700, style: "normal" },
      { name: "ContentGate Sans", data: extra, weight: 800, style: "normal" },
    ]);
  }
  return fontPromise;
}
