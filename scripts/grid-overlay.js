/* eslint-disable @typescript-eslint/no-require-imports */
// Overlays a labeled pixel grid on an image so text-zone coordinates can be
// read off visually at full resolution (or a cropped region of it).
//
// Usage: node scripts/grid-overlay.js <in.png> <out.png> [step=50] [cropX] [cropY] [cropW] [cropH]
const sharp = require("sharp");

async function main() {
  const [inPath, outPath, stepArg, cx, cy, cw, ch] = process.argv.slice(2);
  if (!inPath || !outPath) {
    console.error("Usage: node scripts/grid-overlay.js <in.png> <out.png> [step] [cropX cropY cropW cropH]");
    process.exit(1);
  }
  const step = stepArg ? Number(stepArg) : 50;

  let img = sharp(inPath);
  const meta = await img.metadata();
  let { width, height } = meta;
  let offsetX = 0;
  let offsetY = 0;

  if (cx !== undefined) {
    offsetX = Number(cx);
    offsetY = Number(cy);
    width = Number(cw);
    height = Number(ch);
    img = img.extract({ left: offsetX, top: offsetY, width, height });
  }

  const fontSize = Number(process.env.GRID_FONT || 26);
  const lines = [];
  for (let x = 0; x <= width; x += step) {
    const gx = x + offsetX;
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="lime" stroke-width="1" opacity="0.45"/>`);
    lines.push(`<text x="${x + 3}" y="${fontSize}" font-size="${fontSize}" fill="yellow" stroke="black" stroke-width="0.6">${gx}</text>`);
  }
  for (let y = 0; y <= height; y += step) {
    const gy = y + offsetY;
    lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="lime" stroke-width="1" opacity="0.45"/>`);
    lines.push(`<text x="2" y="${y - 3}" font-size="${fontSize}" fill="yellow" stroke="black" stroke-width="0.6">${gy}</text>`);
  }

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${lines.join("")}</svg>`;

  const base = await img.toBuffer();
  await sharp(base)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(outPath);
  console.log(`wrote ${outPath} (${width}x${height} at offset ${offsetX},${offsetY}, step=${step})`);
}

main();
