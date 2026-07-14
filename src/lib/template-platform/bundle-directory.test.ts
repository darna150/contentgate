import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadTemplateBundleDirectory } from "./bundle-directory.ts";
import { validateTemplateBundleAssetPayloads } from "./importer.ts";
import { validTemplateBundleManifest } from "./test-fixtures.ts";

async function writeBundleDirectory() {
  const root = await mkdtemp(join(tmpdir(), "contentgate-bundle-"));
  await mkdir(join(root, "fonts"), { recursive: true });
  await mkdir(join(root, "variants", "square"), { recursive: true });

  const assets = await Promise.all(
    validTemplateBundleManifest.assets.map(async (asset) => {
      const data = new TextEncoder().encode(`payload:${asset.path}`);
      await writeFile(join(root, asset.path), data);
      return { asset, data };
    })
  );

  const { createHash } = await import("node:crypto");
  const manifest = {
    ...validTemplateBundleManifest,
    assets: validTemplateBundleManifest.assets.map((asset) => ({
      ...asset,
      sha256:
        createHash("sha256")
          .update(assets.find((entry) => entry.asset.key === asset.key)!.data)
          .digest("hex"),
    })),
  };

  await writeFile(join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return { root, manifest };
}

test("loads a bundle directory and verifies asset payload checksums", async () => {
  const { root } = await writeBundleDirectory();
  const bundle = await loadTemplateBundleDirectory(root);
  const issues = validateTemplateBundleAssetPayloads(
    bundle.manifest.assets,
    bundle.assets
  );

  assert.equal(bundle.assets.length, validTemplateBundleManifest.assets.length);
  assert.deepEqual(issues, []);
});

test("rejects bundle asset paths that escape the bundle root", async () => {
  const { root, manifest } = await writeBundleDirectory();
  await writeFile(
    join(root, "manifest.json"),
    JSON.stringify({
      ...manifest,
      assets: [
        {
          ...manifest.assets[0],
          path: "../outside.ttf",
        },
        ...manifest.assets.slice(1),
      ],
    })
  );

  await assert.rejects(
    () => loadTemplateBundleDirectory(root),
    /escapes the bundle root/
  );
});
