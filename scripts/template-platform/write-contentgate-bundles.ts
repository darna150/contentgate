import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { buildContentGateTemplateBundle } from "../../src/lib/template-platform/contentgate-bundle";

const outputRoot = join(process.cwd(), ".template-bundles", "contentgate");

const targets = [
  {
    layoutKey: "contentgate_local_friendly" as const,
    folder: "local-friendly-v1",
  },
  {
    layoutKey: "contentgate_local_premium" as const,
    folder: "local-premium-v1",
  },
];

async function main() {
  for (const target of targets) {
    const bundle = await buildContentGateTemplateBundle(target.layoutKey);
    const outputDirectory = join(outputRoot, target.folder);
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(
      join(outputDirectory, "manifest.json"),
      `${JSON.stringify(bundle.manifest, null, 2)}\n`
    );
    await writeFile(
      join(outputDirectory, "asset-payloads.json"),
      `${JSON.stringify(
        bundle.assets.map((asset) => ({
          path: asset.path,
          contentType: asset.contentType,
          bytes: asset.data.byteLength,
        })),
        null,
        2
      )}\n`
    );
    console.log(`Wrote ${target.layoutKey} to ${outputDirectory}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
