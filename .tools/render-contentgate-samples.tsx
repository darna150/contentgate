import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import { ImageResponse } from "next/og";

import { renderContractTemplate } from "../src/lib/template-renderer";

async function main() {
const projectRoot = "/Users/debbiemelgarejo/Documents/Content Gate/contentgate";
const outDir = "/private/tmp/contentgate-rendered";
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    const file = await readFile(path.join(projectRoot, "public", pathname));
    response.writeHead(200, { "content-type": "image/png" });
    response.end(file);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No render server address");
  const origin = `http://127.0.0.1:${address.port}`;
  const samples = [
    { layoutKey: "contentgate_local_friendly", sizeKey: "square", fields: { local_detail: "For local teams and branches", headline: "Local content, made on brand", subheadline: "Give every team the approved assets and templates they need to make posts, flyers, and promos for their market.", cta: "See how it works", proof_note: "No design skills needed" } },
    { layoutKey: "contentgate_local_friendly", sizeKey: "story", fields: { local_detail: "Localized content made simple", headline: "One brand. Many local markets.", subheadline: "Let teams swap language, dates, offers, and images inside approved templates.", cta: "Create local content", proof_note: "Easy for non-marketers. Controlled for brand teams." } },
    { layoutKey: "contentgate_local_friendly", sizeKey: "link_ad", fields: { local_detail: "Local posts, flyers, and promos", headline: "Localized content without the back-and-forth.", subheadline: "Turn approved brand assets and templates into ready-to-use materials for every branch, dealer, or region.", cta: "Preview workflow", proof_note: "Built for teams who need content, not design software." } },
    { layoutKey: "contentgate_local_friendly", sizeKey: "leaderboard", fields: { headline: "Local content, made on brand", subheadline: "Approved templates for posts, flyers, and promos.", cta: "Preview" } },
    { layoutKey: "contentgate_local_friendly", sizeKey: "medium_rectangle", fields: { headline: "Local content, on brand.", subheadline: "Posts, flyers, and promos your team can customize.", cta: "Preview", proof_note: "No design skills" } },
    { layoutKey: "contentgate_local_premium", sizeKey: "square", fields: { headline: "Local content, made on brand.", subheadline: "Give every branch, dealer, or team the right assets and templates to create posts, flyers, and promos for their market.", cta: "See how it works", proof_note: "Easy for local teams. Controlled for brand." } },
    { layoutKey: "contentgate_local_premium", sizeKey: "portrait", fields: { headline: "Help local teams make content that feels made for them.", subheadline: "Approved templates, images, and copy fields let each location adapt content without waiting on HQ.", cta: "Build a local content kit", proof_note: "For branches, franchises, distributors, and field teams." } },
    { layoutKey: "contentgate_local_premium", sizeKey: "story", fields: { headline: "One brand hub. Many local markets.", subheadline: "Let teams swap language, dates, offers, and images inside approved templates, then send work for review.", cta: "Create localized content", proof_note: "No design skills needed. No off-brand workarounds." } },
    { layoutKey: "contentgate_local_premium", sizeKey: "link_ad", fields: { headline: "Localized marketing content, without the back-and-forth.", subheadline: "Turn approved brand assets and templates into ready-to-use local posts, flyers, banners, and promos.", cta: "Preview the workflow", proof_note: "For teams who need content, not design software." } },
    { layoutKey: "contentgate_local_premium", sizeKey: "medium_rectangle", fields: { headline: "Local content. On brand.", subheadline: "Posts, flyers, and promos your team can customize.", cta: "Preview", proof_note: "No design skills" } },
  ] as const;
  await mkdir(outDir, { recursive: true });
  for (const sample of samples) {
    const rendered = await renderContractTemplate({
      ...sample,
      fields: sample.fields,
      disclaimer: "",
      origin,
      original: false,
    });
    if (!rendered) throw new Error(`Could not render ${sample.layoutKey}/${sample.sizeKey}`);
    const response = new ImageResponse(rendered.element, {
      width: rendered.w,
      height: rendered.h,
      fonts: rendered.fonts,
    });
    const set = sample.layoutKey.endsWith("friendly") ? "set-a" : "set-b";
    await writeFile(
      path.join(outDir, `${set}-${sample.sizeKey}.png`),
      Buffer.from(await response.arrayBuffer()),
    );
  }
} finally {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
}

void main();
