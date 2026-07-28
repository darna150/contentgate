import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { TEMPLATE_BUNDLE_STORAGE_BUCKET } from "./importer";
import type { TemplateBundleManifest } from "./manifest";
import { isPublicContentGateBundle } from "./public-contentgate-assets";
import {
  resolveTemplateBundleAssetStoragePath,
  type TemplateBundleStorageAssetRow,
} from "./storage-path";

export { templateBundleStoragePath } from "./storage-path";

const TEMPLATE_BUNDLE_URL_TTL_SECONDS = 60 * 60;

type StorageClient = Awaited<ReturnType<typeof createClient>>;

export type TemplateBundleStorageSource = {
  versionId: string;
  manifest: TemplateBundleManifest;
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
  sources: readonly TemplateBundleStorageSource[]
) {
  const privateSources = sources.filter(
    ({ manifest }) => !isPublicContentGateBundle(manifest)
  );
  const versionIds = Array.from(new Set(privateSources.map((source) => source.versionId)));
  if (versionIds.length === 0) return new Map<string, string>();

  const { data: storedAssetRows, error: storedAssetError } = await supabase
    .from("template_assets")
    .select("template_version_id, asset_key, sha256, storage_path")
    .eq("org_id", orgId)
    .in("template_version_id", versionIds);
  if (storedAssetError) {
    throw new Error(`Could not load template asset records: ${storedAssetError.message}`);
  }
  const storedAssets = (storedAssetRows ?? []) as TemplateBundleStorageAssetRow[];

  const storagePathFor = (source: TemplateBundleStorageSource, assetIndex: number) =>
    resolveTemplateBundleAssetStoragePath({
      orgId,
      versionId: source.versionId,
      manifest: source.manifest,
      asset: source.manifest.assets[assetIndex],
      storedAssets,
    });
  const paths = Array.from(
    new Set(
      privateSources.flatMap((source) =>
        source.manifest.assets.flatMap((asset, assetIndex) =>
          SIGNED_ASSET_KINDS.has(asset.kind)
            ? [storagePathFor(source, assetIndex)]
            : []
        )
      )
    )
  );
  if (paths.length === 0) return new Map<string, string>();

  const { data, error } = await supabase.storage
    .from(TEMPLATE_BUNDLE_STORAGE_BUCKET)
    .createSignedUrls(paths, TEMPLATE_BUNDLE_URL_TTL_SECONDS);
  if (error) throw new Error(`Could not sign template bundle URLs: ${error.message}`);

  const signedByStoragePath = new Map(
    (data ?? []).flatMap((item) =>
      item.path && item.signedUrl
        ? [[item.path, item.signedUrl] as const]
        : []
    )
  );

  return new Map(
    privateSources.flatMap((source) =>
      source.manifest.assets.flatMap((asset, assetIndex) => {
        if (!SIGNED_ASSET_KINDS.has(asset.kind)) return [];
        const storagePath = storagePathFor(source, assetIndex);
        const signedUrl = signedByStoragePath.get(storagePath);
        return signedUrl ? [[asset.path, signedUrl] as const] : [];
      })
    )
  );
}
