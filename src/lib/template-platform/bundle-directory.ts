import { readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import type { TemplateBundleAssetSource } from "./importer.ts";
import type { TemplateBundleManifest } from "./manifest.ts";

export type TemplateBundleDirectory = {
  root: string;
  manifest: TemplateBundleManifest;
  assets: TemplateBundleAssetSource[];
};

function isInside(parent: string, child: string) {
  const normalizedParent = parent.endsWith(sep) ? parent : `${parent}${sep}`;
  return child === parent || child.startsWith(normalizedParent);
}

function resolveBundlePath(root: string, relativePath: string) {
  if (relativePath.startsWith("/") || relativePath.includes("\\")) {
    throw new Error(`Unsafe bundle asset path: ${relativePath}`);
  }
  const resolved = resolve(root, relativePath);
  if (!isInside(root, resolved)) {
    throw new Error(`Bundle asset path escapes the bundle root: ${relativePath}`);
  }
  return resolved;
}

export async function loadTemplateBundleDirectory(
  directory: string
): Promise<TemplateBundleDirectory> {
  const root = resolve(directory);
  const manifest = JSON.parse(
    await readFile(join(root, "manifest.json"), "utf8")
  ) as TemplateBundleManifest;

  const assets = await Promise.all(
    manifest.assets.map(async (asset) => ({
      path: asset.path,
      data: await readFile(resolveBundlePath(root, asset.path)),
      contentType: asset.mimeType,
    }))
  );

  return { root, manifest, assets };
}
