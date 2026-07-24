import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  isProductAssetApprovalStatus,
  isProductAssetType,
  type ProductAssetApprovalStatus,
  type ProductAssetType,
} from "@/lib/product-assets";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import {
  assetMatchesTemplateBinding,
  fieldHasDamBinding,
  type TemplateDamAssetRow,
} from "@/lib/template-platform/dam-bindings";

export type ProductAssetFilters = {
  productId?: string | null;
  assetType?: ProductAssetType;
  approvalStatus?: ProductAssetApprovalStatus;
  tag?: string;
  search?: string;
};

const PRODUCT_ASSET_URL_TTL_SECONDS = 60 * 60;

export async function createProductAssetPreviewUrlMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePaths: string[]
): Promise<Map<string, string>> {
  const paths = Array.from(new Set(storagePaths.filter(Boolean)));
  if (paths.length === 0) return new Map<string, string>();

  const { data, error } = await supabase.storage
    .from("product-assets")
    .createSignedUrls(paths, PRODUCT_ASSET_URL_TTL_SECONDS);
  if (error) throw new Error(`Could not sign product asset URLs: ${error.message}`);

  const urls = new Map<string, string>();
  for (const item of data ?? []) {
    if (typeof item.path === "string" && typeof item.signedUrl === "string") {
      urls.set(item.path, item.signedUrl);
    }
  }
  return urls;
}

export async function createTemplateDamAssetUrlMap(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orgId: string;
  productId: string;
  manifest: TemplateBundleManifest;
  fields: Record<string, unknown>;
}) {
  const boundFields = input.manifest.fields.filter(fieldHasDamBinding);
  const selectedIds = boundFields
    .map((field) => input.fields[field.key])
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  if (!selectedIds.length) return {};

  const { data, error } = await input.supabase
    .from("product_assets")
    .select("id, product_id, asset_type, title, storage_path, mime_type, media_kind, category, tags")
    .eq("org_id", input.orgId)
    .eq("approval_status", "approved")
    .in("id", selectedIds);
  if (error) throw new Error(`Could not load template DAM assets: ${error.message}`);
  const assets = (data ?? []) as TemplateDamAssetRow[];
  const matchingAssets = assets.filter((asset) =>
    boundFields.some(
      (field) =>
        input.fields[field.key] === asset.id &&
        assetMatchesTemplateBinding({
          asset,
          field,
          productId: input.productId,
        })
    )
  );
  const previewUrls = await createProductAssetPreviewUrlMap(
    input.supabase,
    matchingAssets.map((asset) => asset.storage_path)
  );
  return Object.fromEntries(
    matchingAssets.flatMap((asset) => {
      const url = previewUrls.get(asset.storage_path);
      return url ? [[asset.id, url] as const] : [];
    })
  );
}

export async function listProductAssets(filters: ProductAssetFilters = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) throw new Error("Profile not found");

  let query = supabase
    .from("product_assets")
    .select(
      "id, org_id, product_id, asset_type, title, description, alt_text, storage_path, original_file_name, mime_type, file_size_bytes, width_pixels, height_pixels, tags, approval_status, uploaded_by, created_at, updated_at, media_kind, checksum_sha256, duration_seconds, aspect_ratio, poster_storage_path, category, download_count, last_downloaded_at, products(id, name)"
    )
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false });

  if (filters.productId === null) {
    query = query.is("product_id", null);
  } else if (filters.productId) {
    query = query.eq("product_id", filters.productId);
  }
  if (filters.assetType && isProductAssetType(filters.assetType)) {
    query = query.eq("asset_type", filters.assetType);
  }
  if (
    filters.approvalStatus &&
    isProductAssetApprovalStatus(filters.approvalStatus)
  ) {
    query = query.eq("approval_status", filters.approvalStatus);
  }
  if (filters.tag?.trim()) {
    query = query.contains("tags", [filters.tag.trim().toLowerCase()]);
  }
  if (filters.search?.trim()) {
    query = query.ilike("title", `%${filters.search.trim().slice(0, 100)}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  const previewUrls = await createProductAssetPreviewUrlMap(
    supabase,
    (data ?? []).map((asset) => asset.storage_path)
  );

  return {
    assets: (data ?? []).map((asset) => ({
      ...asset,
      previewUrl: previewUrls.get(asset.storage_path) ?? "",
    })),
    role: profile.role as string,
  };
}
