import path from "node:path";

import sharp from "sharp";

const inputDir = "/private/tmp/contentgate-rendered";
const sets = {
  "set-a": ["square", "story", "link_ad", "leaderboard", "medium_rectangle"],
  "set-b": ["square", "portrait", "story", "link_ad", "medium_rectangle"],
};
const cellWidth = 400;
const cellHeight = 430;

for (const [set, sizes] of Object.entries(sets)) {
  const composites = [];
  for (const [index, size] of sizes.entries()) {
    const image = await sharp(path.join(inputDir, `${set}-${size}.png`))
      .resize(360, 365, { fit: "inside" })
      .png()
      .toBuffer();
    const metadata = await sharp(image).metadata();
    const label = Buffer.from(
      `<svg width="${cellWidth}" height="36"><text x="20" y="25" font-family="Arial" font-size="18" fill="#12312B">${size.replaceAll("_", " ")}</text></svg>`,
    );
    const column = index % 3;
    const row = Math.floor(index / 3);
    composites.push({ input: image, left: column * cellWidth + 20, top: row * cellHeight + 48 });
    composites.push({ input: label, left: column * cellWidth, top: row * cellHeight });
    void metadata;
  }
  await sharp({
    create: { width: 1200, height: 860, channels: 4, background: "#ebe7de" },
  })
    .composite(composites)
    .png()
    .toFile(`/private/tmp/contentgate-${set}-contact.png`);
}
