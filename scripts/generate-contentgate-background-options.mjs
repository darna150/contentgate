import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();

const SETS = ["set-a", "set-b"];
const OPTIONS = [
  {
    key: "mint-glow",
    name: "Mint Glow",
    overlay(width, height) {
      return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="baseMint" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#F8F3E8" stop-opacity="0"/>
              <stop offset="0.52" stop-color="#DFF7EF" stop-opacity="0.2"/>
              <stop offset="1" stop-color="#B8EBD8" stop-opacity="0.28"/>
            </linearGradient>
            <radialGradient id="mint" cx="74%" cy="24%" r="76%">
              <stop offset="0" stop-color="#B8EBD8" stop-opacity="0.42"/>
              <stop offset="0.42" stop-color="#DFF7EF" stop-opacity="0.26"/>
              <stop offset="1" stop-color="#DFF6EE" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="softLight" cx="20%" cy="72%" r="62%">
              <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.38"/>
              <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#baseMint)"/>
          <rect width="${width}" height="${height}" fill="url(#mint)"/>
          <rect width="${width}" height="${height}" fill="url(#softLight)"/>
        </svg>
      `;
    },
  },
  {
    key: "terracotta-edge",
    name: "Terracotta Edge",
    overlay(width, height) {
      return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="warm" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#F2C5AE" stop-opacity="0.24"/>
              <stop offset="0.36" stop-color="#F8F3E8" stop-opacity="0.04"/>
              <stop offset="1" stop-color="#BF5C3B" stop-opacity="0.2"/>
            </linearGradient>
            <radialGradient id="warmPool" cx="88%" cy="82%" r="70%">
              <stop offset="0" stop-color="#E4A083" stop-opacity="0.28"/>
              <stop offset="0.52" stop-color="#F4D6C7" stop-opacity="0.16"/>
              <stop offset="1" stop-color="#F4D6C7" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="warmLift" cx="8%" cy="18%" r="58%">
              <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.38"/>
              <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#warm)"/>
          <rect width="${width}" height="${height}" fill="url(#warmPool)"/>
          <rect width="${width}" height="${height}" fill="url(#warmLift)"/>
        </svg>
      `;
    },
  },
  {
    key: "sage-grid",
    name: "Sage Grid",
    overlay(width, height) {
      return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#DDECE5" stop-opacity="0.22"/>
              <stop offset="0.5" stop-color="#F8F3E8" stop-opacity="0.04"/>
              <stop offset="1" stop-color="#9DBCAF" stop-opacity="0.24"/>
            </linearGradient>
            <radialGradient id="sageAnchor" cx="8%" cy="86%" r="72%">
              <stop offset="0" stop-color="#AFCFC2" stop-opacity="0.28"/>
              <stop offset="0.45" stop-color="#DDECE5" stop-opacity="0.13"/>
              <stop offset="1" stop-color="#DDECE5" stop-opacity="0"/>
            </radialGradient>
            <pattern id="linen" width="18" height="18" patternUnits="userSpaceOnUse">
              <path d="M 18 0 L 0 0 0 18" fill="none" stroke="#0B3D34" stroke-width="1" opacity="0.025"/>
              <path d="M 0 18 L 18 18 18 0" fill="none" stroke="#FFFFFF" stroke-width="1" opacity="0.12"/>
            </pattern>
            <radialGradient id="sageLight" cx="78%" cy="18%" r="62%">
              <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.34"/>
              <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#wash)"/>
          <rect width="${width}" height="${height}" fill="url(#sageAnchor)"/>
          <rect width="${width}" height="${height}" fill="url(#linen)"/>
          <rect width="${width}" height="${height}" fill="url(#sageLight)"/>
        </svg>
      `;
    },
  },
];

async function renderOption(inputPath, outputPath, option) {
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Cannot read dimensions for ${inputPath}`);
  }

  const overlay = Buffer.from(option.overlay(metadata.width, metadata.height));
  await mkdir(dirname(outputPath), { recursive: true });
  await image
    .composite([{ input: overlay, blend: "over" }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);
}

for (const set of SETS) {
  const backgroundDir = join(ROOT, "public", "template-packages", "contentgate", set, "backgrounds");
  const files = set === "set-a"
    ? ["square.png", "story.png", "link-ad.png", "leaderboard.png", "medium-rectangle.png"]
    : ["square.png", "portrait.png", "story.png", "link-ad.png", "medium-rectangle.png"];

  for (const file of files) {
    for (const option of OPTIONS) {
      await renderOption(
        join(backgroundDir, file),
        join(ROOT, "public", "template-packages", "contentgate", set, "background-options", option.key, file),
        option
      );
    }
  }
}

console.log("Generated ContentGate background options.");
