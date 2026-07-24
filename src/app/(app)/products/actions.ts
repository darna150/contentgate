"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildProductAssetStoragePath,
  cleanProductAssetText,
  defaultProductAssetTitle,
  isProductAssetApprovalStatus,
  isProductAssetStoragePath,
  isProductAssetType,
  parseProductAssetTags,
  productAssetMediaKindForMimeType,
  validateProductAssetFile,
} from "@/lib/product-assets";

const SHARP_IMAGE_MIME_TYPES: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  heif: "image/avif",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const VIDEO_ASSET_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
type SourceParagraph = { n: number; text: string };

function normalizeSourceParagraphs(value: unknown): SourceParagraph[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (typeof item === "string") return { n: index + 1, text: item };
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const n = typeof record.n === "number" ? record.n : index + 1;
        const text = typeof record.text === "string" ? record.text : "";
        return { n, text };
      }
      return { n: index + 1, text: "" };
    })
    .filter((paragraph) => paragraph.text.trim());
}

function isMissingProductClaimSourceColumn(error: { message?: string } | null) {
  return Boolean(
    error?.message?.includes("product_claims.source_document_id") ||
      error?.message?.includes("product_claims.source_paragraph_n") ||
      error?.message?.includes("product_claims.source_excerpt")
  );
}

async function insertProductClaim(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: {
    org_id: string;
    product_id: string;
    claim_text: string;
    status: "approved";
    source_document_id?: string | null;
    source_paragraph_n?: number | null;
    source_excerpt?: string | null;
  }
) {
  const { error } = await supabase.from("product_claims").insert(payload);
  if (!isMissingProductClaimSourceColumn(error)) return error;

  const fallbackPayload = {
    org_id: payload.org_id,
    product_id: payload.product_id,
    claim_text: payload.claim_text,
    status: payload.status,
  };
  const fallback = await supabase.from("product_claims").insert(fallbackPayload);
  return fallback.error;
}

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
  const sourceDocumentId = cleanProductAssetText(formData.get("source_document_id"), 80);
  const sourceParagraphRaw = cleanProductAssetText(formData.get("source_paragraph_n"), 12);
  let sourceParagraphN: number | null = null;
  if (sourceParagraphRaw) {
    const parsedParagraph = Number.parseInt(sourceParagraphRaw, 10);
    if (!Number.isInteger(parsedParagraph) || parsedParagraph <= 0) {
      throw new Error("Choose a valid source paragraph number.");
    }
    sourceParagraphN = parsedParagraph;
  }
  if (sourceDocumentId) {
    const { data: sourceDocument, error: sourceError } = await supabase
      .from("documents")
      .select("id, paragraphs")
      .eq("id", sourceDocumentId)
      .eq("org_id", orgId)
      .eq("product_id", productId)
      .maybeSingle();
    if (sourceError) throw sourceError;
    if (!sourceDocument) throw new Error("Choose a valid source document for this product.");
    if (!sourceParagraphN) throw new Error("Choose a source paragraph for this claim.");
    const sourceParagraph = normalizeSourceParagraphs(sourceDocument.paragraphs).find(
      (paragraph) => paragraph.n === sourceParagraphN
    );
    if (!sourceParagraph) throw new Error("Choose a valid source paragraph for this document.");
    const error = await insertProductClaim(supabase, {
      org_id: orgId,
      product_id: productId,
      claim_text: claimText,
      status: "approved",
      source_document_id: sourceDocumentId,
      source_paragraph_n: sourceParagraph.n,
      source_excerpt: sourceParagraph.text,
    });
    if (error) throw error;
    revalidatePath(`/products/${productId}/edit`);
    revalidatePath(`/products/${productId}`);
    return;
  }
  const error = await insertProductClaim(supabase, {
    org_id: orgId,
    product_id: productId,
    claim_text: claimText,
    status: "approved",
    source_document_id: null,
    source_paragraph_n: null,
    source_excerpt: null,
  });
  if (error) throw error;
  revalidatePath(`/products/${productId}/edit`);
  revalidatePath(`/products/${productId}`);
}

export async function setClaimStatus(claimId: string, productId: string, status: string) {
  if (status !== "approved" && status !== "inactive") {
    throw new Error(`Unsupported claim status: ${status}`);
  }
  const { supabase } = await getAdminOrgId();
  const { error } = await supabase
    .from("product_claims")
    .update({ status })
    .eq("id", claimId);
  if (error) throw new Error(`Could not update claim status: ${error.message}`);
  revalidatePath(`/products/${productId}/edit`);
}

export async function archiveProduct(productId: string) {
  const { supabase } = await getAdminOrgId();
  await supabase.from("products").update({ status: "archived" }).eq("id", productId);
  revalidatePath("/products");
  redirect("/products");
}

export async function uploadProductAsset(productId: string, formData: FormData) {
  const { supabase, orgId, userId } = await getAdminOrgId();
  const assetProductId = productId === "brand" ? null : productId;
  const assetType = String(formData.get("asset_type") ?? "");
  const file = formData.get("file");
  if (!isProductAssetType(assetType)) throw new Error("Choose a valid asset type.");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose an asset.");
  validateProductAssetFile(file);

  if (assetProductId) {
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", assetProductId)
      .eq("org_id", orgId)
      .eq("status", "active")
      .maybeSingle();
    if (productError) throw productError;
    if (!product) throw new Error("Active product not found.");
  }

  const title =
    cleanProductAssetText(formData.get("title"), 120) ??
    defaultProductAssetTitle(file.name);
  const fileBytes = Buffer.from(await file.arrayBuffer());
  const checksumSha256 = createHash("sha256").update(fileBytes).digest("hex");
  const mediaKind = productAssetMediaKindForMimeType(file.type);
  if (!mediaKind) throw new Error("Unsupported asset media type.");
  if (assetType === "video" && mediaKind !== "video") {
    throw new Error("Video assets require an MP4, MOV, or WebM file.");
  }
  if (assetType !== "video" && mediaKind === "video") {
    throw new Error("Choose Video as the asset type for video files.");
  }
  let widthPixels: number | null = null;
  let heightPixels: number | null = null;
  let aspectRatio: number | null = null;
  let durationSeconds: number | null = null;
  let detectedMimeType: string | null = null;
  if (mediaKind === "image") {
    try {
      const metadata = await sharp(fileBytes).metadata();
      detectedMimeType = metadata.format
        ? SHARP_IMAGE_MIME_TYPES[metadata.format] ?? null
        : null;
      if (metadata.width && metadata.height) {
        widthPixels = metadata.width;
        heightPixels = metadata.height;
        aspectRatio = Math.round((metadata.width / metadata.height) * 1_000_000) / 1_000_000;
      }
    } catch {
      throw new Error("The selected file is not a readable image.");
    }
    if (!detectedMimeType || detectedMimeType !== file.type) {
      throw new Error("The image contents do not match the selected file type.");
    }
  } else {
    if (!VIDEO_ASSET_MIME_TYPES.has(file.type)) {
      throw new Error("Use an MP4, MOV, or WebM video.");
    }
    detectedMimeType = file.type;
    const durationRaw = cleanProductAssetText(formData.get("duration_seconds"), 24);
    const parsedDuration = durationRaw ? Number(durationRaw) : NaN;
    if (Number.isFinite(parsedDuration) && parsedDuration >= 0) {
      durationSeconds = Math.round(parsedDuration * 1000) / 1000;
    }
  }
  const storagePath = buildProductAssetStoragePath(orgId, assetProductId, file.name);
  const { error: uploadError } = await supabase.storage
    .from("product-assets")
    .upload(storagePath, fileBytes, { contentType: detectedMimeType, upsert: false });
  if (uploadError) throw uploadError;

  const { data: asset, error } = await supabase
    .from("product_assets")
    .insert({
      org_id: orgId,
      product_id: assetProductId,
      asset_type: assetType,
      storage_path: storagePath,
      title,
      description: cleanProductAssetText(formData.get("description"), 500),
      alt_text: cleanProductAssetText(formData.get("alt_text"), 300),
      original_file_name: file.name.slice(0, 255),
      mime_type: detectedMimeType,
      file_size_bytes: file.size,
      width_pixels: widthPixels,
      height_pixels: heightPixels,
      media_kind: mediaKind,
      checksum_sha256: checksumSha256,
      duration_seconds: durationSeconds,
      aspect_ratio: aspectRatio,
      category: cleanProductAssetText(formData.get("category"), 80),
      tags: parseProductAssetTags(formData.get("tags")),
      approval_status: "approved",
      uploaded_by: userId,
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
    detail: {
      product_id: assetProductId,
      asset_type: assetType,
      title,
      file_name: file.name,
      mime_type: detectedMimeType,
      file_size_bytes: file.size,
      width_pixels: widthPixels,
      height_pixels: heightPixels,
      media_kind: mediaKind,
      checksum_sha256: checksumSha256,
      duration_seconds: durationSeconds,
    },
  });
  revalidatePath("/assets");
  if (assetProductId) {
    revalidatePath(`/products/${assetProductId}`);
    revalidatePath(`/products/${assetProductId}/edit`);
  }
}

export async function updateProductAssetMetadata(
  assetId: string,
  productId: string | null,
  formData: FormData
) {
  const { supabase, orgId, userId } = await getAdminOrgId();
  const title = cleanProductAssetText(formData.get("title"), 120);
  const approvalStatus = String(formData.get("approval_status") ?? "approved");
  if (!title) throw new Error("Asset title is required.");
  if (!isProductAssetApprovalStatus(approvalStatus)) {
    throw new Error("Choose a valid approval status.");
  }

  let readQuery = supabase
    .from("product_assets")
    .select("id, title, approval_status")
    .eq("id", assetId)
    .eq("org_id", orgId);
  if (productId) {
    readQuery = readQuery.eq("product_id", productId);
  } else {
    readQuery = readQuery.is("product_id", null);
  }
  const { data: existing, error: readError } = await readQuery.maybeSingle();
  if (readError) throw readError;
  if (!existing) throw new Error("Asset not found.");

  const changes = {
    title,
    description: cleanProductAssetText(formData.get("description"), 500),
    alt_text: cleanProductAssetText(formData.get("alt_text"), 300),
    tags: parseProductAssetTags(formData.get("tags")),
    category: cleanProductAssetText(formData.get("category"), 80),
    approval_status: approvalStatus,
  };
  const updateQuery = supabase
    .from("product_assets")
    .update(changes)
    .eq("id", assetId)
    .eq("org_id", orgId);
  if (productId) {
    updateQuery.eq("product_id", productId);
  } else {
    updateQuery.is("product_id", null);
  }
  const { error } = await updateQuery;
  if (error) throw error;

  await writeAudit({
    org_id: orgId,
    actor_id: userId,
    action: "product_asset.updated",
    entity_type: "product_asset",
    entity_id: assetId,
    detail: {
      product_id: productId,
      previous_title: existing.title,
      previous_approval_status: existing.approval_status,
      ...changes,
    },
  });
  revalidatePath("/assets");
  if (productId) {
    revalidatePath(`/products/${productId}`);
    revalidatePath(`/products/${productId}/edit`);
  }
}

export async function deleteProductAsset(assetId: string, productId: string | null) {
  const { supabase, orgId, userId } = await getAdminOrgId();
  let readQuery = supabase
    .from("product_assets")
    .select("id, storage_path, asset_type, title")
    .eq("id", assetId)
    .eq("org_id", orgId);
  if (productId) {
    readQuery = readQuery.eq("product_id", productId);
  } else {
    readQuery = readQuery.is("product_id", null);
  }
  const { data: asset, error: readError } = await readQuery.maybeSingle();
  if (readError) throw readError;
  if (!asset) return;
  if (!isProductAssetStoragePath(asset.storage_path, orgId, productId)) {
    throw new Error("Asset storage path does not match its organization and product.");
  }

  const { error: storageError } = await supabase.storage
    .from("product-assets")
    .remove([asset.storage_path]);
  if (storageError) throw storageError;

  let deleteQuery = supabase
    .from("product_assets")
    .delete()
    .eq("id", assetId)
    .eq("org_id", orgId);
  if (productId) {
    deleteQuery = deleteQuery.eq("product_id", productId);
  } else {
    deleteQuery = deleteQuery.is("product_id", null);
  }
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;
  await writeAudit({
    org_id: orgId,
    actor_id: userId,
    action: "product_asset.deleted",
    entity_type: "product_asset",
    entity_id: assetId,
    detail: {
      product_id: productId,
      asset_type: asset.asset_type,
      title: asset.title,
      storage_path: asset.storage_path,
    },
  });
  revalidatePath("/assets");
  if (productId) {
    revalidatePath(`/products/${productId}`);
    revalidatePath(`/products/${productId}/edit`);
  }
}

export async function createProductAssetDownloadUrl(assetId: string) {
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

  const { data: asset, error: assetError } = await supabase
    .from("product_assets")
    .select("id, org_id, product_id, title, storage_path, original_file_name, approval_status, download_count")
    .eq("id", assetId)
    .eq("org_id", profile.org_id)
    .maybeSingle();
  if (assetError) throw assetError;
  if (!asset) throw new Error("Asset not found.");
  if (asset.approval_status !== "approved" && profile.role !== "admin") {
    throw new Error("This asset can be downloaded after approval.");
  }

  const { data, error } = await supabase.storage
    .from("product-assets")
    .createSignedUrl(asset.storage_path, 60 * 10, {
      download: asset.original_file_name || asset.title,
    });
  if (error || !data?.signedUrl) {
    throw new Error(`Could not create download URL: ${error?.message ?? "Unknown error"}`);
  }

  await supabase
    .from("product_assets")
    .update({
      download_count: (asset.download_count ?? 0) + 1,
      last_downloaded_at: new Date().toISOString(),
    })
    .eq("id", asset.id)
    .eq("org_id", profile.org_id);

  await writeAudit({
    org_id: profile.org_id,
    actor_id: user.id,
    action: "product_asset.downloaded",
    entity_type: "product_asset",
    entity_id: asset.id,
    detail: {
      product_id: asset.product_id,
      title: asset.title,
      storage_path: asset.storage_path,
    },
  });

  return data.signedUrl;
}
