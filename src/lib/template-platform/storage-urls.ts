import "server-only";

import { TEMPLATE_BUNDLE_STORAGE_BUCKET } from "./importer";
import type { TemplateBundleManifest } from "./manifest";
import { isPublicContentGateBundle } from "./public-contentgate-assets";
import { templateBundleStoragePath } from "./storage-path";

export { templateBundleStoragePath } from "./storage-path";

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

// Includes "font" alongside "background"/"reference": renderer image fonts
// (loadTemplateBundleImageFonts) and the fit engine (loadTemplateBundleFontData)
// both resolve fonts through this same URL map, falling back to public/fonts
// only for ContentGate. Excluding "font" here meant every non-public bundle
// font had no signed URL to load from, in fit checks and in live Satori
// rendering alike.
const SIGNED_ASSET_KINDS = new Set(["background", "font", "reference"]);

export async function createTemplateBundleAssetUrlMap(
  supabase: StorageClient,
  orgId: string,
  manifests: readonly TemplateBundleManifest[]
) {
  const privateManifests = manifests.filter(
    (manifest) => !isPublicContentGateBundle(manifest)
  );
  const paths = Array.from(
    new Set(
      privateManifests.flatMap((manifest) =>
        manifest.assets
          .filter((asset) => SIGNED_ASSET_KINDS.has(asset.kind))
          .map((asset) => templateBundleStoragePath(orgId, manifest, asset.path))
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
    privateManifests.flatMap((manifest) =>
      manifest.assets
        .filter((asset) => SIGNED_ASSET_KINDS.has(asset.kind))
        .flatMap((asset) => {
          const storagePath = templateBundleStoragePath(orgId, manifest, asset.path);
          const signedUrl = signedByStoragePath.get(storagePath);
          return signedUrl ? [[asset.path, signedUrl] as const] : [];
        })
    )
  );
}
