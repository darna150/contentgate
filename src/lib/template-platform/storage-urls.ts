import "server-only";

import { TEMPLATE_BUNDLE_STORAGE_BUCKET, templateBundleStoragePrefix } from "./importer";
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

// Must match exactly where importTemplateBundle uploads each asset — an
// org-scoped prefix ({orgId}/template-bundles/{family}/{version}) built by the
// same helper the importer uses. Reconstructing a non-org-scoped path here (as
// this once did) signs objects that don't exist, so the URL map comes back
// empty and the renderer falls through to broken relative asset paths.
export function templateBundleStoragePath(
  orgId: string,
  manifest: TemplateBundleManifest,
  assetPath: string
) {
  return `${templateBundleStoragePrefix({ orgId, manifest })}/${assetPath}`;
}

// Includes "font" alongside "background"/"reference": renderer image fonts
// (loadTemplateBundleImageFonts) and the fit engine (loadTemplateBundleFontData)
// both resolve fonts through this same URL map. Excluding "font" here meant
// every bundle font had no signed URL to load from, in fit checks and in live
// Satori rendering alike.
const SIGNED_ASSET_KINDS = new Set(["background", "font", "image", "reference"]);

export async function createTemplateBundleAssetUrlMap(
  supabase: StorageClient,
  orgId: string,
  manifests: readonly TemplateBundleManifest[]
) {
  const paths = Array.from(
    new Set(
      manifests.flatMap((manifest) =>
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
    manifests.flatMap((manifest) =>
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
