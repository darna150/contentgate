import { readFile } from "node:fs/promises";
import { join } from "node:path";

type ContentGateFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600 | 700 | 800;
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
      readPublicFont("Inter-Regular.ttf"),
      readPublicFont("Inter-Medium.ttf"),
      readPublicFont("Inter-SemiBold.ttf"),
      readPublicFont("Inter-Bold.ttf"),
    ]).then(
      ([regular, semi, bold, extra, interRegular, interMedium, interSemi, interBold]) => [
        { name: "ContentGate Sans", data: regular, weight: 400, style: "normal" },
        { name: "ContentGate Sans", data: semi, weight: 600, style: "normal" },
        { name: "ContentGate Sans", data: bold, weight: 700, style: "normal" },
        { name: "ContentGate Sans", data: extra, weight: 800, style: "normal" },
        { name: "Inter", data: interRegular, weight: 400, style: "normal" },
        { name: "Inter", data: interMedium, weight: 500, style: "normal" },
        { name: "Inter", data: interSemi, weight: 600, style: "normal" },
        { name: "Inter", data: interBold, weight: 700, style: "normal" },
      ]
    );
  }
  return fontPromise;
}
