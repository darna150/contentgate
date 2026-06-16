// Renders a visual diff mask (red = differs beyond threshold) between a
// background (text-free) PNG and a reference (text baked in) PNG, so the
// text zone can be read visually instead of guessed from noisy row stats.
//
// Usage: node scripts/diff-image.js <background.png> <reference.png> <out.png> [threshold]
const sharp = require("sharp");

async function main() {
  const [bgPath, refPath, outPath, thresholdArg] = process.argv.slice(2);
  if (!bgPath || !refPath || !outPath) {
    console.error("Usage: node scripts/diff-image.js <background.png> <reference.png> <out.png> [threshold]");
    process.exit(1);
  }
  const threshold = thresholdArg ? Number(thresholdArg) : 60;

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
  const out = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const idx = i * channels;
    const oidx = i * 4;
    const dr = Math.abs(bg.data[idx] - ref.data[idx]);
    const dg = Math.abs(bg.data[idx + 1] - ref.data[idx + 1]);
    const db = Math.abs(bg.data[idx + 2] - ref.data[idx + 2]);
    const diff = dr + dg + db;
    if (diff > threshold) {
      out[oidx] = 255;
      out[oidx + 1] = 0;
      out[oidx + 2] = 0;
      out[oidx + 3] = 255;
    } else {
      // dim original reference so we can see context
      out[oidx] = ref.data[idx] >> 1;
      out[oidx + 1] = ref.data[idx + 1] >> 1;
      out[oidx + 2] = ref.data[idx + 2] >> 1;
      out[oidx + 3] = 255;
    }
  }

  await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(outPath);
  console.log(`wrote ${outPath} (${width}x${height}, threshold=${threshold})`);
}

main();
