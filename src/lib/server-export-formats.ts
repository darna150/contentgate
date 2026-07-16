import sharp from "sharp";
import type { SizeKey } from "./creative";

export type ServerExportFormat = "png" | "jpeg" | "pdf";

function ascii(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function jpegPdf(input: {
  jpeg: Uint8Array;
  width: number;
  height: number;
  size: SizeKey;
}): Uint8Array {
  const pageWidth = input.size === "a4" ? 595.28 : input.width * 0.75;
  const pageHeight = input.size === "a4" ? 841.89 : input.height * 0.75;
  const content = ascii(
    `q\n${pageWidth.toFixed(2)} 0 0 ${pageHeight.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`
  );
  const objects = [
    ascii("<< /Type /Catalog /Pages 2 0 R >>"),
    ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    ascii(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(
        2
      )} ${pageHeight.toFixed(
        2
      )}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
    ),
    concatBytes([
      ascii(
        `<< /Type /XObject /Subtype /Image /Width ${input.width} /Height ${input.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${input.jpeg.length} >>\nstream\n`
      ),
      input.jpeg,
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
    ...offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  ].join("");
  chunks.push(ascii(xref));
  return concatBytes(chunks);
}

export async function convertServerRenderedPng(input: {
  png: ArrayBuffer;
  width: number;
  height: number;
  size: SizeKey;
  format: ServerExportFormat;
}): Promise<{ body: Uint8Array; contentType: string; extension: string }> {
  if (input.format === "png") {
    return {
      body: new Uint8Array(input.png),
      contentType: "image/png",
      extension: "png",
    };
  }

  const jpeg = await sharp(Buffer.from(input.png))
    .jpeg({ quality: 95, mozjpeg: true })
    .toBuffer();

  if (input.format === "jpeg") {
    return {
      body: jpeg,
      contentType: "image/jpeg",
      extension: "jpg",
    };
  }

  return {
    body: jpegPdf({
      jpeg,
      width: input.width,
      height: input.height,
      size: input.size,
    }),
    contentType: "application/pdf",
    extension: "pdf",
  };
}
