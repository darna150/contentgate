/* eslint-disable @typescript-eslint/no-require-imports */
// Measures text zones by diffing a reference (with baked-in text) PNG against
// the text-free background PNG. Clusters rows with meaningful pixel diff into
// horizontal bands, then reports the x-range within each band.
//
// Usage: node scripts/diff-bands.js <background.png> <reference.png> [threshold]
const sharp = require("sharp");
const path = require("path");

async function main() {
  const [bgPath, refPath, thresholdArg] = process.argv.slice(2);
  if (!bgPath || !refPath) {
    console.error("Usage: node scripts/diff-bands.js <background.png> <reference.png> [threshold]");
    process.exit(1);
  }
  const threshold = thresholdArg ? Number(thresholdArg) : 28;

  const [bg, ref] = await Promise.all([
    sharp(bgPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(refPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);

  if (bg.info.width !== ref.info.width || bg.info.height !== ref.info.height) {
    console.error(
      `Size mismatch: background ${bg.info.width}x${bg.info.height} vs reference ${ref.info.width}x${ref.info.height}`
    );
    process.exit(1);
  }

  const { width, height, channels } = bg.info;
  const bgData = bg.data;
  const refData = ref.data;

  // Per-pixel diff mask, then per-row diff pixel count + per-row x bounds.
  const rowCounts = new Array(height).fill(0);
  const rowMinX = new Array(height).fill(Infinity);
  const rowMaxX = new Array(height).fill(-Infinity);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const dr = Math.abs(bgData[idx] - refData[idx]);
      const dg = Math.abs(bgData[idx + 1] - refData[idx + 1]);
      const db = Math.abs(bgData[idx + 2] - refData[idx + 2]);
      const diff = dr + dg + db;
      if (diff > threshold) {
        rowCounts[y]++;
        if (x < rowMinX[y]) rowMinX[y] = x;
        if (x > rowMaxX[y]) rowMaxX[y] = x;
      }
    }
  }

  const minRowPixels = Math.max(2, Math.floor(width * 0.002));
  const isInk = rowCounts.map((c) => c >= minRowPixels);

  // Cluster contiguous (allowing small gaps) ink rows into bands.
  const maxGap = Math.round(height * 0.012) + 4;
  const bands = [];
  let cur = null;
  let gapRun = 0;
  for (let y = 0; y < height; y++) {
    if (isInk[y]) {
      if (!cur) {
        cur = { y0: y, y1: y };
      } else {
        cur.y1 = y;
      }
      gapRun = 0;
    } else if (cur) {
      gapRun++;
      if (gapRun > maxGap) {
        bands.push(cur);
        cur = null;
        gapRun = 0;
      }
    }
  }
  if (cur) bands.push(cur);

  console.log(`${path.basename(bgPath)} vs ${path.basename(refPath)} — ${width}x${height}`);
  for (const band of bands) {
    let x0 = Infinity;
    let x1 = -Infinity;
    for (let y = band.y0; y <= band.y1; y++) {
      if (rowMinX[y] < x0) x0 = rowMinX[y];
      if (rowMaxX[y] > x1) x1 = rowMaxX[y];
    }
    const h = band.y1 - band.y0 + 1;
    if (h < 4) continue; // skip noise slivers
    console.log(
      `  y ${band.y0}-${band.y1} (h=${h})  x ${x0}-${x1} (w=${x1 - x0 + 1})`
    );
  }
}

main();
