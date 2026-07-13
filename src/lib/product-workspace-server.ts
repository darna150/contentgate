import "server-only";

import type {
  ProductAssetApprovalStatus,
  ProductAssetType,
} from "@/lib/product-assets";
import {
  getWorkspacePermissions,
  getWorkspaceSectionStates,
  isWorkspaceRole,
  type WorkspaceRole,
} from "@/lib/product-workspace";
import { createClient } from "@/lib/supabase/server";

type Joined<T> = T | T[] | null;

export type ProductWorkspaceAsset = {
  id: string;
  assetType: ProductAssetType;
  title: string;
  description: string | null;
  altText: string | null;
  originalFileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  widthPixels: number | null;
  heightPixels: number | null;
  tags: string[];
  approvalStatus: ProductAssetApprovalStatus;
  storagePath: string;
  previewUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductWorkspaceSource = {
  id: string;
  title: string;
  fileType: string | null;
  storagePath: string | null;
  createdAt: string;
};

export type ProductWorkspaceClaim = {
  id: string;
  claimText: string;
  status: string;
};

export type ProductWorkspaceTemplate = {
  id: string;
  category: string;
  variant: string;
  layoutKey: string;
  editableFields: string[];
  generationInstructions: string;
  defaultCopy: Record<string, string>;
  status: string;
  sortOrder: number;
};

export type ProductWorkspaceContent = {
  id: string;
  title: string;
  status: string;
  targetLanguage: string;
  audience: string | null;
  templateId: string | null;
  templateVariant: string | null;
  templateCategory: string | null;
  createdBy: string;
  creatorName: string | null;
  rejectionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductWorkspace = {
  viewer: {
    id: string;
    orgId: string;
    role: WorkspaceRole;
  };
  product: {
    id: string;
    orgId: string;
    name: string;
    description: string | null;
    disclaimerText: string | null;
    status: string;
    createdAt: string;
  };
  assets: ProductWorkspaceAsset[];
  approvedSources: ProductWorkspaceSource[];
  claims: ProductWorkspaceClaim[];
  templates: ProductWorkspaceTemplate[];
  activeTemplates: ProductWorkspaceTemplate[];
  content: ProductWorkspaceContent[];
  approvals: ProductWorkspaceContent[];
  counts: {
    assets: number;
    approvedSources: number;
    approvedClaims: number;
    templates: number;
    activeTemplates: number;
    content: number;
    inReview: number;
    contentByStatus: Record<string, number>;
  };
  permissions: ReturnType<typeof getWorkspacePermissions>;
  sections: ReturnType<typeof getWorkspaceSectionStates>;
};

type AssetRow = {
  id: string;
  asset_type: ProductAssetType;
  title: string;
  description: string | null;
  alt_text: string | null;
  original_file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  width_pixels: number | null;
  height_pixels: number | null;
  tags: string[] | null;
  approval_status: ProductAssetApprovalStatus;
  storage_path: string;
  created_at: string;
  updated_at: string;
};

type ContentRow = {
  id: string;
  title: string;
  status: string;
  target_language: string;
  audience: string | null;
  product_template_id: string | null;
  created_by: string;
  rejection_note: string | null;
  created_at: string;
  updated_at: string;
  product_templates: Joined<{ variant: string; category: string }>;
  creator: Joined<{ full_name: string | null }>;
};

function one<T>(value: Joined<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function assertQuery(error: { message: string } | null, label: string) {
  if (error) throw new Error(`Could not load workspace ${label}: ${error.message}`);
}

export async function getProductWorkspace(
  productId: string
): Promise<ProductWorkspace | null> {
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
  assertQuery(profileError, "viewer");
  if (!profile || !isWorkspaceRole(profile.role)) {
    throw new Error("Workspace profile not found");
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, org_id, name, description, disclaimer_text, status, created_at")
    .eq("id", productId)
    .eq("org_id", profile.org_id)
    .maybeSingle();
  assertQuery(productError, "product");
  if (!product) return null;

  const [assetResult, sourceResult, claimResult, templateResult, contentResult] =
    await Promise.all([
      supabase
        .from("product_assets")
        .select(
          "id, asset_type, title, description, alt_text, original_file_name, mime_type, file_size_bytes, width_pixels, height_pixels, tags, approval_status, storage_path, created_at, updated_at"
        )
        .eq("org_id", profile.org_id)
        .eq("product_id", productId)
        .order("created_at", { ascending: false }),
      supabase
        .from("documents")
        .select("id, title, file_type, storage_path, created_at")
        .eq("org_id", profile.org_id)
        .eq("product_id", productId)
        .order("created_at", { ascending: false }),
      supabase
        .from("product_claims")
        .select("id, claim_text, status")
        .eq("org_id", profile.org_id)
        .eq("product_id", productId)
        .order("created_at", { ascending: true }),
      supabase
        .from("product_templates")
        .select(
          "id, category, variant, layout_key, editable_fields, generation_instructions, default_copy, status, sort_order"
        )
        .eq("org_id", profile.org_id)
        .eq("product_id", productId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("generated_content")
        .select(
          "id, title, status, target_language, audience, product_template_id, created_by, rejection_note, created_at, updated_at, product_templates(variant, category), creator:profiles!generated_content_created_by_fkey(full_name)"
        )
        .eq("org_id", profile.org_id)
        .eq("product_id", productId)
        .order("updated_at", { ascending: false }),
    ]);

  assertQuery(assetResult.error, "assets");
  assertQuery(sourceResult.error, "sources");
  assertQuery(claimResult.error, "claims");
  assertQuery(templateResult.error, "templates");
  assertQuery(contentResult.error, "content");

  const assets = ((assetResult.data ?? []) as AssetRow[]).map((asset) => ({
    id: asset.id,
    assetType: asset.asset_type,
    title: asset.title,
    description: asset.description,
    altText: asset.alt_text,
    originalFileName: asset.original_file_name,
    mimeType: asset.mime_type,
    fileSizeBytes: asset.file_size_bytes,
    widthPixels: asset.width_pixels,
    heightPixels: asset.height_pixels,
    tags: asset.tags ?? [],
    approvalStatus: asset.approval_status,
    storagePath: asset.storage_path,
    previewUrl: supabase.storage
      .from("product-assets")
      .getPublicUrl(asset.storage_path).data.publicUrl,
    createdAt: asset.created_at,
    updatedAt: asset.updated_at,
  }));

  const approvedSources = (sourceResult.data ?? []).map((source) => ({
    id: source.id,
    title: source.title,
    fileType: source.file_type,
    storagePath: source.storage_path,
    createdAt: source.created_at,
  }));
  const claims = (claimResult.data ?? []).map((claim) => ({
    id: claim.id,
    claimText: claim.claim_text,
    status: claim.status,
  }));
  const templates = (templateResult.data ?? []).map((template) => ({
    id: template.id,
    category: template.category,
    variant: template.variant,
    layoutKey: template.layout_key,
    editableFields: (template.editable_fields ?? []) as string[],
    generationInstructions: template.generation_instructions,
    defaultCopy: (template.default_copy ?? {}) as Record<string, string>,
    status: template.status,
    sortOrder: template.sort_order,
  }));
  const content = ((contentResult.data ?? []) as ContentRow[]).map((row) => {
    const template = one(row.product_templates);
    const creator = one(row.creator);
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      targetLanguage: row.target_language,
      audience: row.audience,
      templateId: row.product_template_id,
      templateVariant: template?.variant ?? null,
      templateCategory: template?.category ?? null,
      createdBy: row.created_by,
      creatorName: creator?.full_name ?? null,
      rejectionNote: row.rejection_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  const activeTemplates = templates.filter(
    (template) => template.status === "active"
  );
  const approvedClaims = claims.filter((claim) => claim.status === "approved");
  const approvals = content.filter((item) => item.status === "in_review");
  const contentByStatus = content.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
  const counts = {
    assets: assets.length,
    approvedSources: approvedSources.length,
    approvedClaims: approvedClaims.length,
    templates: templates.length,
    activeTemplates: activeTemplates.length,
    content: content.length,
    inReview: approvals.length,
    contentByStatus,
  };
  const permissions = getWorkspacePermissions({
    role: profile.role,
    productStatus: product.status,
    activeTemplateCount: activeTemplates.length,
  });

  return {
    viewer: {
      id: user.id,
      orgId: profile.org_id,
      role: profile.role,
    },
    product: {
      id: product.id,
      orgId: product.org_id,
      name: product.name,
      description: product.description,
      disclaimerText: product.disclaimer_text,
      status: product.status,
      createdAt: product.created_at,
    },
    assets,
    approvedSources,
    claims,
    templates,
    activeTemplates,
    content,
    approvals,
    counts,
    permissions,
    sections: getWorkspaceSectionStates({
      productId,
      counts,
      permissions,
    }),
  };
}
