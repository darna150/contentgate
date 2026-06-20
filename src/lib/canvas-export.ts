"use client";

import { toCanvas } from "html-to-image";
import type { SizeKey } from "./creative";

export type ExportFormat = "png" | "jpeg" | "pdf";

let apexFontCssPromise: Promise<string> | null = null;

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function apexFontCss() {
  if (!apexFontCssPromise) {
    const fonts = [
      ["Apex Fraunces", 700, "/fonts/Fraunces9pt-Bold.woff2"],
      ["Apex Nourd", 400, "/fonts/Nourd-Regular.woff2"],
      ["Apex Nourd", 700, "/fonts/Nourd-Bold.woff2"],
    ] as const;
    apexFontCssPromise = Promise.all(
      fonts.map(async ([family, weight, url]) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not load export font: ${url}`);
        const dataUrl = await blobDataUrl(await response.blob());
        return `@font-face{font-family:"${family}";src:url("${dataUrl}") format("woff2");font-style:normal;font-weight:${weight};}`;
      })
    ).then((rules) => rules.join(""));
  }
  return apexFontCssPromise;
}

async function waitForCanvasAssets(node: HTMLElement) {
  await document.fonts.ready;
  const imagePromises = Array.from(node.querySelectorAll("img")).map((image) =>
    image.complete ? Promise.resolve() : image.decode()
  );
  const backgroundUrls = Array.from(node.querySelectorAll<HTMLElement>("*"))
    .map((element) => getComputedStyle(element).backgroundImage)
    .flatMap((background) =>
      Array.from(background.matchAll(/url\(["']?(.+?)["']?\)/g), (match) => match[1])
    );
  const backgroundPromises = [...new Set(backgroundUrls)].map(
    (url) =>
      new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`Could not load export asset: ${url}`));
        image.src = url;
      })
  );
  await Promise.all([
    ...imagePromises,
    ...backgroundPromises,
  ]);
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  type: "image/png" | "image/jpeg",
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed."))),
      type,
      quality
    );
  });
}

function ascii(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concatBytes(
  chunks: Uint8Array<ArrayBufferLike>[]
): Uint8Array<ArrayBuffer> {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(new ArrayBuffer(length));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function jpegPdf(jpeg: Uint8Array, width: number, height: number, size: SizeKey): Blob {
  const pageWidth = size === "a4" ? 595.28 : width * 0.75;
  const pageHeight = size === "a4" ? 841.89 : height * 0.75;
  const content = ascii(
    `q\n${pageWidth.toFixed(2)} 0 0 ${pageHeight.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`
  );
  const objects = [
    ascii("<< /Type /Catalog /Pages 2 0 R >>"),
    ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    ascii(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
    ),
    concatBytes([
      ascii(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
      ),
      jpeg,
      ascii("\nendstream"),
    ]),
    concatBytes([
      ascii(`<< /Length ${content.length} >>\nstream\n`),
      content,
      ascii("endstream"),
    ]),
  ];

  const chunks: Uint8Array[] = [ascii("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(length);
    const wrapped = concatBytes([
      ascii(`${index + 1} 0 obj\n`),
      object,
      ascii("\nendobj\n"),
    ]);
    chunks.push(wrapped);
    length += wrapped.length;
  });

  const xrefOffset = length;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  ].join("");
  chunks.push(ascii(xref));
  return new Blob([concatBytes(chunks)], { type: "application/pdf" });
}

export async function exportCanvas({
  node,
  width,
  height,
  size,
  format,
  filename,
}: {
  node: HTMLElement;
  width: number;
  height: number;
  size: SizeKey;
  format: ExportFormat;
  filename: string;
}) {
  await waitForCanvasAssets(node);
  const fontEmbedCSS = await apexFontCss();
  const canvas = await toCanvas(node, {
    width,
    height,
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: "#ffffff",
    fontEmbedCSS,
  });
  const blob = await canvasBlob(
    canvas,
    format === "png" ? "image/png" : "image/jpeg",
    format === "png" ? undefined : 0.95
  );

  if (format === "pdf") {
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    downloadBlob(jpegPdf(jpeg, width, height, size), `${filename}.pdf`);
    return;
  }

  downloadBlob(blob, `${filename}.${format === "jpeg" ? "jpg" : "png"}`);
}
