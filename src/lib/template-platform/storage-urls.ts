import "server-only";

import { TEMPLATE_BUNDLE_STORAGE_BUCKET } from "./importer";
import type { TemplateBundleManifest } from "./manifest";

const TEMPLATE_BUNDLE_URL_TTL_SECONDS = 60 * 60;

type StorageClient = {
  storage: {
    from(bucket: string): {
      createSignedUrls(
        paths: string[],
        expiresIn: number
      ): Promise<{
        data:
          | Array<{ path: string | null; signedUrl: string | null }>
          | null;
        error: { message: string } | null;
      }>;
    };
  };
};

export function templateBundleStoragePath(
  manifest: TemplateBundleManifest,
  assetPath: string
) {
  return [
    "template-bundles",
    manifest.family.key,
    manifest.version.name,
    assetPath,
  ].join("/");
}

export async function createTemplateBundleAssetUrlMap(
  supabase: StorageClient,
  manifests: readonly TemplateBundleManifest[]
) {
  const paths = Array.from(
    new Set(
      manifests.flatMap((manifest) =>
        manifest.assets
          .filter((asset) => asset.kind === "background" || asset.kind === "reference")
          .map((asset) => templateBundleStoragePath(manifest, asset.path))
      )
    )
  );
  if (paths.length === 0) return new Map<string, string>();

  const { data, error } = await supabase.storage
    .from(TEMPLATE_BUNDLE_STORAGE_BUCKET)
    .createSignedUrls(paths, TEMPLATE_BUNDLE_URL_TTL_SECONDS);
  if (error) throw new Error(`Could not sign template bundle URLs: ${error.message}`);

  const signedByStoragePath = new Map(
    (data ?? [])
      .filter(
        (item): item is { path: string; signedUrl: string } =>
          Boolean(item.path && item.signedUrl)
      )
      .map((item) => [item.path, item.signedUrl] as const)
  );

  return new Map(
    manifests.flatMap((manifest) =>
      manifest.assets
        .filter((asset) => asset.kind === "background" || asset.kind === "reference")
        .flatMap((asset) => {
          const storagePath = templateBundleStoragePath(manifest, asset.path);
          const signedUrl = signedByStoragePath.get(storagePath);
          return signedUrl ? [[asset.path, signedUrl] as const] : [];
        })
    )
  );
}
