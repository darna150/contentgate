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
  detectProductAssetVideoMimeType,
  isProductAssetApprovalStatus,
  isProductAssetStoragePath,
  isProductAssetType,
  parseProductAssetTags,
  productAssetMediaKindForMimeType,
  validateProductAssetFile,
  validateProductAssetTransparency,
  type ProductAssetType,
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

export type ProductAssetUploadIntentInput = {
  productId: string;
  assetType: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  title?: string;
  description?: string;
  altText?: string;
  tags?: string;
  category?: string;
};

function productAssetPaths(productId: string | null) {
  return productId
    ? [`/products/${productId}`, `/products/${productId}/edit`]
    : [];
}

async function assertActiveAssetProduct(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orgId: string;
  productId: string | null;
}) {
  if (!input.productId) return;
  const { data: product, error } = await input.supabase
    .from("products")
    .select("id")
    .eq("id", input.productId)
    .eq("org_id", input.orgId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!product) throw new Error("Active product not found.");
}

async function inspectUploadedProductAsset(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  storagePath: string;
  mimeType: string;
  mediaKind: "image" | "video" | "document";
  assetType: ProductAssetType;
}) {
  const { data: signed, error: signedError } = await input.supabase.storage
    .from("product-assets")
    .createSignedUrl(input.storagePath, 60);
  if (signedError || !signed?.signedUrl) {
    throw new Error(`Could not inspect uploaded asset: ${signedError?.message ?? "Unknown error"}`);
  }

  if (input.mediaKind === "video") {
    const response = await fetch(signed.signedUrl, {
      headers: { Range: "bytes=0-65535" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Could not inspect uploaded video.");
    const detectedMimeType = detectProductAssetVideoMimeType(
      new Uint8Array(await response.arrayBuffer()),
      input.mimeType
    );
    if (!detectedMimeType) {
      throw new Error("The uploaded video contents do not match the selected file type.");
    }
    return {
      detectedMimeType,
      widthPixels: null,
      heightPixels: null,
      aspectRatio: null,
      checksumSha256: null,
    };
  }

  if (input.mediaKind === "document") {
    return {
      detectedMimeType: input.mimeType,
      widthPixels: null,
      heightPixels: null,
      aspectRatio: null,
      checksumSha256: null,
    };
  }

  const { data: blob, error: downloadError } = await input.supabase.storage
    .from("product-assets")
    .download(input.storagePath);
  if (downloadError || !blob) {
    throw new Error(`Could not inspect uploaded image: ${downloadError?.message ?? "Unknown error"}`);
  }
  const bytes = Buffer.from(await blob.arrayBuffer());
  try {
    const metadata = await sharp(bytes).metadata();
    const detectedMimeType = metadata.format
      ? SHARP_IMAGE_MIME_TYPES[metadata.format] ?? null
      : null;
    if (!detectedMimeType || detectedMimeType !== input.mimeType) {
      throw new Error("The uploaded image contents do not match the selected file type.");
    }
    if (input.assetType === "packshot") {
      const stats = await sharp(bytes).stats();
      validateProductAssetTransparency(input.assetType, metadata.hasAlpha, stats.isOpaque);
    }
    const widthPixels = metadata.width ?? null;
    const heightPixels = metadata.height ?? null;
    return {
      detectedMimeType,
      widthPixels,
      heightPixels,
      aspectRatio:
        widthPixels && heightPixels
          ? Math.round((widthPixels / heightPixels) * 1_000_000) / 1_000_000
          : null,
      checksumSha256: createHash("sha256").update(bytes).digest("hex"),
    };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("The uploaded file is not a readable image.");
  }
}

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

/**
 * Reserves an organization-scoped, private object path before the browser
 * starts a resumable upload. The returned token is short lived and only valid
 * for this immutable object path.
 */
export async function createProductAssetUploadIntent(
  input: ProductAssetUploadIntentInput
) {
  const { supabase, orgId, userId } = await getAdminOrgId();
  const assetProductId = input.productId === "brand" ? null : input.productId;
  if (!isProductAssetType(input.assetType)) throw new Error("Choose a valid asset type.");
  const fileName = input.fileName.trim();
  if (!fileName) throw new Error("Choose an asset.");
  validateProductAssetFile({ size: input.fileSizeBytes, type: input.mimeType });

  const mediaKind = productAssetMediaKindForMimeType(input.mimeType);
  if (!mediaKind) throw new Error("Unsupported asset media type.");
  if (input.assetType === "video" && mediaKind !== "video") {
    throw new Error("Video assets require an MP4, MOV, or WebM file.");
  }
  if (input.assetType !== "video" && mediaKind === "video") {
    throw new Error("Choose Video as the asset type for video files.");
  }
  await assertActiveAssetProduct({ supabase, orgId, productId: assetProductId });

  const assetId = crypto.randomUUID();
  const storagePath = buildProductAssetStoragePath(orgId, assetProductId, fileName, assetId);
  const title = cleanProductAssetText(input.title ?? null, 120) ?? defaultProductAssetTitle(fileName);
  const { error: insertError } = await supabase.from("product_assets").insert({
    id: assetId,
    org_id: orgId,
    product_id: assetProductId,
    asset_type: input.assetType,
    storage_path: storagePath,
    title,
    description: cleanProductAssetText(input.description ?? null, 500),
    alt_text: cleanProductAssetText(input.altText ?? null, 300),
    original_file_name: fileName.slice(0, 255),
    mime_type: input.mimeType,
    file_size_bytes: input.fileSizeBytes,
    media_kind: mediaKind,
    category: cleanProductAssetText(input.category ?? null, 80),
    tags: parseProductAssetTags(input.tags ?? ""),
    approval_status: "processing",
    uploaded_by: userId,
  });
  if (insertError) throw insertError;

  const { data: signedUpload, error: signedUploadError } = await supabase.storage
    .from("product-assets")
    .createSignedUploadUrl(storagePath);
  if (signedUploadError || !signedUpload?.token) {
    await supabase.from("product_assets").delete().eq("id", assetId).eq("org_id", orgId);
    throw new Error(
      `Could not prepare asset upload: ${signedUploadError?.message ?? "Unknown error"}`
    );
  }

  await writeAudit({
    org_id: orgId,
    actor_id: userId,
    action: "product_asset.upload_started",
    entity_type: "product_asset",
    entity_id: assetId,
    detail: {
      product_id: assetProductId,
      asset_type: input.assetType,
      title,
      file_name: fileName,
      mime_type: input.mimeType,
      file_size_bytes: input.fileSizeBytes,
    },
  });

  return {
    assetId,
    storagePath,
    uploadToken: signedUpload.token,
  };
}

export async function finalizeProductAssetUpload(assetId: string) {
  const { supabase, orgId, userId } = await getAdminOrgId();
  const { data: asset, error: readError } = await supabase
    .from("product_assets")
    .select(
      "id, product_id, asset_type, storage_path, mime_type, file_size_bytes, media_kind, approval_status, title"
    )
    .eq("id", assetId)
    .eq("org_id", orgId)
    .eq("uploaded_by", userId)
    .maybeSingle();
  if (readError) throw readError;
  if (!asset) throw new Error("Upload intent not found.");
  if (asset.approval_status !== "processing") {
    throw new Error("This upload has already been finalized.");
  }
  if (!isProductAssetType(asset.asset_type)) throw new Error("Asset type is invalid.");
  const mediaKind = productAssetMediaKindForMimeType(asset.mime_type);
  if (!mediaKind || mediaKind !== asset.media_kind) throw new Error("Asset media type is invalid.");
  if (!isProductAssetStoragePath(asset.storage_path, orgId, asset.product_id)) {
    throw new Error("Asset storage path does not match its organization and product.");
  }

  const { data: object, error: infoError } = await supabase.storage
    .from("product-assets")
    .info(asset.storage_path);
  if (infoError || !object) {
    throw new Error("The upload has not completed yet. Wait a moment and try again.");
  }
  if (object.size !== asset.file_size_bytes || object.contentType !== asset.mime_type) {
    throw new Error("The uploaded file does not match its reserved upload details.");
  }

  try {
    const inspected = await inspectUploadedProductAsset({
      supabase,
      storagePath: asset.storage_path,
      mimeType: asset.mime_type,
      mediaKind,
      assetType: asset.asset_type,
    });
    const jobTypes = mediaKind === "video"
      ? ["video_probe", "video_poster", "video_transcode"]
      : mediaKind === "image"
        ? ["image_derivatives"]
        : ["document_metadata"];
    const { error: updateError } = await supabase
      .from("product_assets")
      .update({
        mime_type: inspected.detectedMimeType,
        width_pixels: inspected.widthPixels,
        height_pixels: inspected.heightPixels,
        aspect_ratio: inspected.aspectRatio,
        checksum_sha256: inspected.checksumSha256,
        // The worker is the only component allowed to publish the completed
        // rendition set. Keep the asset hidden until every job succeeds.
        approval_status: "processing",
      })
      .eq("id", asset.id)
      .eq("org_id", orgId)
      .eq("approval_status", "processing");
    if (updateError) throw updateError;
    const { error: jobError } = await supabase.from("asset_media_jobs").insert(
      jobTypes.map((jobType) => ({
        org_id: orgId,
        asset_id: asset.id,
        job_type: jobType,
        input: { storage_path: asset.storage_path, media_kind: mediaKind },
      }))
    );
    if (jobError) throw jobError;

    await writeAudit({
      org_id: orgId,
      actor_id: userId,
      action: "product_asset.processing_queued",
      entity_type: "product_asset",
      entity_id: asset.id,
      detail: {
        product_id: asset.product_id,
        title: asset.title,
        mime_type: inspected.detectedMimeType,
        width_pixels: inspected.widthPixels,
        height_pixels: inspected.heightPixels,
        checksum_sha256: inspected.checksumSha256,
        jobs: jobTypes,
      },
    });
  } catch (error) {
    await supabase
      .from("product_assets")
      .update({ approval_status: "rejected" })
      .eq("id", asset.id)
      .eq("org_id", orgId)
      .eq("approval_status", "processing");
    await writeAudit({
      org_id: orgId,
      actor_id: userId,
      action: "product_asset.upload_rejected",
      entity_type: "product_asset",
      entity_id: asset.id,
      detail: {
        product_id: asset.product_id,
        title: asset.title,
        reason: error instanceof Error ? error.message : "Upload inspection failed.",
      },
    });
    throw error;
  }

  revalidatePath("/assets");
  for (const path of productAssetPaths(asset.product_id)) revalidatePath(path);
}

export async function cancelProductAssetUpload(assetId: string) {
  const { supabase, orgId, userId } = await getAdminOrgId();
  const { data: asset, error: readError } = await supabase
    .from("product_assets")
    .select("id, product_id, storage_path, title")
    .eq("id", assetId)
    .eq("org_id", orgId)
    .eq("uploaded_by", userId)
    .eq("approval_status", "processing")
    .maybeSingle();
  if (readError) throw readError;
  if (!asset) return;

  const { error: removeError } = await supabase.storage
    .from("product-assets")
    .remove([asset.storage_path]);
  if (removeError && !/not found/i.test(removeError.message)) throw removeError;
  const { error: deleteError } = await supabase
    .from("product_assets")
    .delete()
    .eq("id", asset.id)
    .eq("org_id", orgId)
    .eq("approval_status", "processing");
  if (deleteError) throw deleteError;

  await writeAudit({
    org_id: orgId,
    actor_id: userId,
    action: "product_asset.upload_cancelled",
    entity_type: "product_asset",
    entity_id: asset.id,
    detail: { product_id: asset.product_id, title: asset.title },
  });
  revalidatePath("/assets");
  for (const path of productAssetPaths(asset.product_id)) revalidatePath(path);
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

export async function archiveProductAsset(assetId: string, productId: string | null) {
  const { supabase, orgId, userId } = await getAdminOrgId();
  let readQuery = supabase
    .from("product_assets")
    .select("id, storage_path, asset_type, title, archived_at")
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
  if (asset.archived_at) return;
  if (!isProductAssetStoragePath(asset.storage_path, orgId, productId)) {
    throw new Error("Asset storage path does not match its organization and product.");
  }

  let archiveQuery = supabase
    .from("product_assets")
    .update({
      archived_at: new Date().toISOString(),
      // Retain the original and all versions for a recoverable 30-day window.
      purge_after: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString(),
    })
    .eq("id", assetId)
    .eq("org_id", orgId)
    .is("archived_at", null);
  if (productId) {
    archiveQuery = archiveQuery.eq("product_id", productId);
  } else {
    archiveQuery = archiveQuery.is("product_id", null);
  }
  const { error: archiveError } = await archiveQuery;
  if (archiveError) throw archiveError;
  await writeAudit({
    org_id: orgId,
    actor_id: userId,
    action: "product_asset.archived",
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

export async function restoreProductAsset(assetId: string, productId: string | null) {
  const { supabase, orgId, userId } = await getAdminOrgId();
  let query = supabase
    .from("product_assets")
    .select("id, product_id, title, archived_at")
    .eq("id", assetId)
    .eq("org_id", orgId);
  query = productId ? query.eq("product_id", productId) : query.is("product_id", null);
  const { data: asset, error: readError } = await query.maybeSingle();
  if (readError) throw readError;
  if (!asset) throw new Error("Asset not found.");
  if (!asset.archived_at) return;

  const { error: restoreError } = await supabase
    .from("product_assets")
    .update({ archived_at: null, purge_after: null })
    .eq("id", asset.id)
    .eq("org_id", orgId);
  if (restoreError) throw restoreError;
  await writeAudit({
    org_id: orgId,
    actor_id: userId,
    action: "product_asset.restored",
    entity_type: "product_asset",
    entity_id: asset.id,
    detail: { product_id: asset.product_id, title: asset.title },
  });
  revalidatePath("/assets");
  for (const path of productAssetPaths(asset.product_id)) revalidatePath(path);
}

export async function retryProductAssetMedia(assetId: string) {
  const { supabase, orgId, userId } = await getAdminOrgId();
  const { data: asset, error: assetError } = await supabase
    .from("product_assets")
    .select("id, product_id, title, approval_status")
    .eq("id", assetId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (assetError) throw assetError;
  if (!asset) throw new Error("Asset not found.");

  const { data: failedJobs, error: jobsError } = await supabase
    .from("asset_media_jobs")
    .select("id")
    .eq("asset_id", asset.id)
    .eq("status", "failed");
  if (jobsError) throw jobsError;
  if (!failedJobs?.length) throw new Error("This asset has no failed media jobs to retry.");

  const { error: retryError } = await supabase
    .from("asset_media_jobs")
    .update({
      status: "queued",
      attempt_count: 0,
      run_after: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      locked_at: null,
      locked_by: null,
      error_message: null,
    })
    .in("id", failedJobs.map((job) => job.id));
  if (retryError) throw retryError;
  const { error: restoreError } = await supabase
    .from("product_assets")
    .update({ approval_status: "processing" })
    .eq("id", asset.id)
    .eq("org_id", orgId);
  if (restoreError) throw restoreError;

  await writeAudit({
    org_id: orgId,
    actor_id: userId,
    action: "product_asset.media_retry_requested",
    entity_type: "product_asset",
    entity_id: asset.id,
    detail: { product_id: asset.product_id, title: asset.title, job_count: failedJobs.length },
  });
  revalidatePath("/assets");
  for (const path of productAssetPaths(asset.product_id)) revalidatePath(path);
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
    .select("id, org_id, product_id, title, storage_path, original_file_name, approval_status")
    .eq("id", assetId)
    .eq("org_id", profile.org_id)
    .is("archived_at", null)
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

  const { error: recordError } = await supabase.rpc("record_product_asset_download", {
    p_asset_id: asset.id,
  });
  if (recordError) {
    throw new Error(`Could not record asset download: ${recordError.message}`);
  }

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
