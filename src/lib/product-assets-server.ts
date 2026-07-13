import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  isProductAssetApprovalStatus,
  isProductAssetType,
  type ProductAssetApprovalStatus,
  type ProductAssetType,
} from "@/lib/product-assets";

export type ProductAssetFilters = {
  productId?: string;
  assetType?: ProductAssetType;
  approvalStatus?: ProductAssetApprovalStatus;
  tag?: string;
  search?: string;
};

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
      "id, org_id, product_id, asset_type, title, description, alt_text, storage_path, original_file_name, mime_type, file_size_bytes, width_pixels, height_pixels, tags, approval_status, uploaded_by, created_at, updated_at, products!inner(id, name)"
    )
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false });

  if (filters.productId) query = query.eq("product_id", filters.productId);
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

  return {
    assets: (data ?? []).map((asset) => ({
      ...asset,
      previewUrl: supabase.storage
        .from("product-assets")
        .getPublicUrl(asset.storage_path).data.publicUrl,
    })),
    role: profile.role as string,
  };
}

