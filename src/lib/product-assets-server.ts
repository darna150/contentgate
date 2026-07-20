import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  isProductAssetApprovalStatus,
  isProductAssetType,
  type ProductAssetApprovalStatus,
  type ProductAssetType,
} from "@/lib/product-assets";

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
) {
  const paths = Array.from(new Set(storagePaths.filter(Boolean)));
  if (paths.length === 0) return new Map<string, string>();

  const { data, error } = await supabase.storage
    .from("product-assets")
    .createSignedUrls(paths, PRODUCT_ASSET_URL_TTL_SECONDS);
  if (error) throw new Error(`Could not sign product asset URLs: ${error.message}`);

  return new Map(
    (data ?? [])
      .filter((item) => item.signedUrl)
      .map((item) => [item.path, item.signedUrl] as const)
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
      "id, org_id, product_id, asset_type, title, description, alt_text, storage_path, original_file_name, mime_type, file_size_bytes, width_pixels, height_pixels, tags, approval_status, uploaded_by, created_at, updated_at, products(id, name)"
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
