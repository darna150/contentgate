"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getAdminOrgId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Admins only");
  return { supabase, orgId: profile.org_id as string, userId: user.id };
}

async function writeAudit(entry: {
  org_id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  detail?: Record<string, unknown>;
}) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const { error } = await createAdminClient().from("audit_log").insert(entry);
  if (error) console.error("audit_log insert failed:", error.message);
}

export async function createProduct(formData: FormData) {
  const { supabase, orgId } = await getAdminOrgId();
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Product name is required");
  const { data, error } = await supabase
    .from("products")
    .insert({
      org_id: orgId,
      name,
      description: (formData.get("description") as string)?.trim() || null,
      disclaimer_text: (formData.get("disclaimer_text") as string)?.trim() || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/products");
  redirect(`/products/${data.id}`);
}

export async function updateProduct(productId: string, formData: FormData) {
  const { supabase } = await getAdminOrgId();
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Product name is required");
  const { error } = await supabase
    .from("products")
    .update({
      name,
      description: (formData.get("description") as string)?.trim() || null,
      disclaimer_text: (formData.get("disclaimer_text") as string)?.trim() || null,
    })
    .eq("id", productId);
  if (error) throw error;
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/${productId}/edit`);
  revalidatePath("/products");
  redirect(`/products/${productId}`);
}

export async function addClaim(productId: string, formData: FormData) {
  const { supabase, orgId } = await getAdminOrgId();
  const claimText = (formData.get("claim_text") as string)?.trim();
  if (!claimText) return;
  await supabase.from("product_claims").insert({
    org_id: orgId,
    product_id: productId,
    claim_text: claimText,
    status: "approved",
  });
  revalidatePath(`/products/${productId}/edit`);
}

export async function setClaimStatus(claimId: string, productId: string, status: string) {
  const { supabase } = await getAdminOrgId();
  await supabase.from("product_claims").update({ status }).eq("id", claimId);
  revalidatePath(`/products/${productId}/edit`);
}

export async function deleteClaim(claimId: string, productId: string) {
  const { supabase } = await getAdminOrgId();
  await supabase.from("product_claims").delete().eq("id", claimId);
  revalidatePath(`/products/${productId}/edit`);
}

export async function archiveProduct(productId: string) {
  const { supabase } = await getAdminOrgId();
  await supabase.from("products").update({ status: "archived" }).eq("id", productId);
  revalidatePath("/products");
  redirect("/products");
}

const ASSET_TYPES = new Set(["logo", "packshot", "background", "image"]);

export async function uploadProductAsset(productId: string, formData: FormData) {
  const { supabase, orgId, userId } = await getAdminOrgId();
  const assetType = String(formData.get("asset_type") ?? "");
  const file = formData.get("file");
  if (!ASSET_TYPES.has(assetType)) throw new Error("Choose a valid asset type.");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose an image.");
  if (!file.type.startsWith("image/")) throw new Error("Product assets must be images.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Images must be 10 MB or smaller.");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
  const storagePath = `${orgId}/${productId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("product-assets")
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { data: asset, error } = await supabase
    .from("product_assets")
    .insert({
      org_id: orgId,
      product_id: productId,
      asset_type: assetType,
      storage_path: storagePath,
    })
    .select("id")
    .single();
  if (error) {
    await supabase.storage.from("product-assets").remove([storagePath]);
    throw error;
  }

  await writeAudit({
    org_id: orgId,
    actor_id: userId,
    action: "product_asset.created",
    entity_type: "product_asset",
    entity_id: asset.id,
    detail: { product_id: productId, asset_type: assetType, file_name: file.name },
  });
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/${productId}/edit`);
}

export async function deleteProductAsset(assetId: string, productId: string) {
  const { supabase, orgId, userId } = await getAdminOrgId();
  const { data: asset } = await supabase
    .from("product_assets")
    .select("id, storage_path, asset_type")
    .eq("id", assetId)
    .eq("product_id", productId)
    .single();
  if (!asset) return;

  const { error } = await supabase.from("product_assets").delete().eq("id", assetId);
  if (error) throw error;
  await supabase.storage.from("product-assets").remove([asset.storage_path]);
  await writeAudit({
    org_id: orgId,
    actor_id: userId,
    action: "product_asset.deleted",
    entity_type: "product_asset",
    entity_id: assetId,
    detail: { product_id: productId, asset_type: asset.asset_type },
  });
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/${productId}/edit`);
}
