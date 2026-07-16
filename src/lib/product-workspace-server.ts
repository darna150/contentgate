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
import { createProductAssetPreviewUrlMap } from "@/lib/product-assets-server";
import {
  documentIndexStatus,
  type DocumentIndexStatus,
} from "@/lib/document-index-status";
import {
  normalizeTemplatePlatformAssignment,
  type TemplatePlatformAssignmentRow,
} from "@/lib/template-platform/assignments";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import { cursorFromOffset, offsetFromCursor } from "@/lib/content-listing-shared";

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
  indexStatus: DocumentIndexStatus;
  createdAt: string;
};

export type ProductWorkspaceClaim = {
  id: string;
  claimText: string;
  status: string;
};

export type ProductWorkspacePlatformTemplate = {
  assignmentId: string;
  productId: string;
  familyId: string;
  familyKey: string;
  familyName: string;
  versionId: string;
  versionLabel: string;
  supportedSizes: string[];
  defaultVariantKey: string;
  fieldCount: number;
  fieldsBySize: Record<string, string[]>;
  variantMetaBySize: Record<string, { label: string; width: number; height: number }>;
  referenceAssetBySize: Record<string, string>;
  backgroundAssetBySize: Record<string, string>;
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
  templateVersionId: string | null;
  sizeKey: string | null;
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
  platformTemplates: ProductWorkspacePlatformTemplate[];
  activePlatformTemplates: ProductWorkspacePlatformTemplate[];
  content: ProductWorkspaceContent[];
  approvals: ProductWorkspaceContent[];
  approvalsNextCursor: string | null;
  approvalsHasMore: boolean;
  counts: {
    assets: number;
    approvedSources: number;
    approvedClaims: number;
    activeTemplates: number;
    platformTemplates: number;
    activePlatformTemplates: number;
    content: number;
    inReview: number;
    contentByStatus: Record<string, number>;
  };
  permissions: ReturnType<typeof getWorkspacePermissions>;
  sections: ReturnType<typeof getWorkspaceSectionStates>;
};

type ProductWorkspaceView =
  | "overview"
  | "assets"
  | "knowledge"
  | "templates"
  | "content"
  | "approvals";

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
  template_version_id: string | null;
  template_variant_id: string | null;
  created_by: string;
  rejection_note: string | null;
  created_at: string;
  updated_at: string;
  product_templates: Joined<{ variant: string; category: string }>;
  template_versions: Joined<{
    version_label: string;
    template_families: Joined<{ name: string }>;
  }>;
  template_variants: Joined<{ label: string; variant_key: string }>;
  creator: Joined<{ full_name: string | null }>;
};

type SourceRow = {
  id: string;
  title: string;
  file_type: string | null;
  storage_path: string | null;
  content_text: string | null;
  paragraphs: unknown;
  created_at: string;
};

function one<T>(value: Joined<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function assertQuery(error: { message: string } | null, label: string) {
  if (error) throw new Error(`Could not load workspace ${label}: ${error.message}`);
}

function publicTemplateBundleAssetPath(
  manifest: TemplateBundleManifest,
  assetPath: string
) {
  const isPublicContentGateAsset =
    manifest.version.name === "figwright-v1" &&
    manifest.family.key.startsWith("contentgate-local-");
  const normalizedAssetPath = assetPath.replace(/^\//, "");
  const path = normalizedAssetPath.startsWith("template-packages/contentgate/")
    ? `/${normalizedAssetPath}`
    : [
        "",
        "template-bundles",
        manifest.family.key,
        manifest.version.name,
        normalizedAssetPath,
      ].join("/");
  return isPublicContentGateAsset
    ? `${path}?v=clean-figwright-2026-07-14-03`
    : path;
}

export async function getProductWorkspace(
  productId: string,
  options: {
    view?: ProductWorkspaceView;
    approvalCursor?: string | null;
    approvalPageSize?: number;
  } = {}
): Promise<ProductWorkspace | null> {
  const view = options.view ?? "overview";
  const needsAssetRows = view === "assets";
  const needsContentRows = view !== "assets" && view !== "knowledge";
  const paginatesApprovals = view === "approvals";
  const approvalOffset = offsetFromCursor(options.approvalCursor);
  const approvalPageSize = Math.min(Math.max(options.approvalPageSize ?? 20, 1), 100);
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

  const assetQuery = supabase
    .from("product_assets")
    .select(
      needsAssetRows
        ? "id, asset_type, title, description, alt_text, original_file_name, mime_type, file_size_bytes, width_pixels, height_pixels, tags, approval_status, storage_path, created_at, updated_at"
        : "id, storage_path"
    )
    .eq("org_id", profile.org_id)
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  let contentQuery = supabase
    .from("generated_content")
    .select(
      needsContentRows
        ? "id, title, status, target_language, audience, product_template_id, template_version_id, template_variant_id, created_by, rejection_note, created_at, updated_at, product_templates(variant, category), template_versions(version_label, template_families(name)), template_variants(label, variant_key), creator:profiles!generated_content_created_by_fkey(full_name)"
        : "id, status"
    )
    .eq("org_id", profile.org_id)
    .eq("product_id", productId);

  if (paginatesApprovals) {
    contentQuery = contentQuery
      .eq("status", "in_review")
      .order("created_at", { ascending: true })
      .range(approvalOffset, approvalOffset + approvalPageSize);
  } else {
    contentQuery = contentQuery.order("updated_at", { ascending: false });
  }

  const contentCountQuery = paginatesApprovals
    ? supabase
        .from("generated_content")
        .select("id", { count: "exact", head: true })
        .eq("org_id", profile.org_id)
        .eq("product_id", productId)
    : Promise.resolve({ count: null, error: null });
  const inReviewCountQuery = paginatesApprovals
    ? supabase
        .from("generated_content")
        .select("id", { count: "exact", head: true })
        .eq("org_id", profile.org_id)
        .eq("product_id", productId)
        .eq("status", "in_review")
    : Promise.resolve({ count: null, error: null });

  const [
    assetResult,
    sourceResult,
    claimResult,
    platformTemplateResult,
    contentResult,
    contentCountResult,
    inReviewCountResult,
  ] =
    await Promise.all([
      assetQuery,
      supabase
        .from("documents")
        .select("id, title, file_type, storage_path, content_text, paragraphs, created_at")
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
        .from("product_template_assignments")
        .select(
          "id, product_id, status, default_variant_key, generation_profile, default_payload, template_families(id, family_key, name), template_versions(id, version_label, status, manifest)"
        )
        .eq("org_id", profile.org_id)
        .eq("product_id", productId)
        .order("created_at", { ascending: true }),
      contentQuery,
      contentCountQuery,
      inReviewCountQuery,
    ]);

  assertQuery(assetResult.error, "assets");
  assertQuery(sourceResult.error, "sources");
  assertQuery(claimResult.error, "claims");
  assertQuery(platformTemplateResult.error, "platform templates");
  assertQuery(contentResult.error, "content");
  assertQuery(contentCountResult.error, "content count");
  assertQuery(inReviewCountResult.error, "approval count");

  const assetPreviewUrls = needsAssetRows
    ? await createProductAssetPreviewUrlMap(
        supabase,
        ((assetResult.data ?? []) as unknown as AssetRow[]).map((asset) => asset.storage_path)
      )
    : new Map<string, string>();

  const assets = needsAssetRows
    ? ((assetResult.data ?? []) as unknown as AssetRow[]).map((asset) => ({
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
        previewUrl: assetPreviewUrls.get(asset.storage_path) ?? "",
        createdAt: asset.created_at,
        updatedAt: asset.updated_at,
      }))
    : [];

  const approvedSources = ((sourceResult.data ?? []) as SourceRow[]).map((source) => ({
    id: source.id,
    title: source.title,
    fileType: source.file_type,
    storagePath: source.storage_path,
    indexStatus: documentIndexStatus({
      contentText: source.content_text,
      paragraphs: source.paragraphs,
      storagePath: source.storage_path,
    }),
    createdAt: source.created_at,
  }));
  const claims = (claimResult.data ?? []).map((claim) => ({
    id: claim.id,
    claimText: claim.claim_text,
    status: claim.status,
  }));
  const normalizedPlatformTemplates = ((platformTemplateResult.data ?? []) as TemplatePlatformAssignmentRow[])
    .map(normalizeTemplatePlatformAssignment)
    .filter((template): template is NonNullable<typeof template> => Boolean(template));
  const platformTemplates = normalizedPlatformTemplates.map((template) => {
      const fieldsBySize = Object.fromEntries(
        template.supportedSizes.map((size) => {
          const variant = template.manifest.variants.find((item) => item.key === size);
          return [
            size,
            variant ? [...new Set(variant.slots.map((slot) => slot.field))] : [],
          ];
        })
      );
      const variantMetaBySize = Object.fromEntries(
        template.supportedSizes.map((size) => {
          const variant = template.manifest.variants.find((item) => item.key === size);
          return [
            size,
            {
              label: variant?.label ?? size,
              width: variant?.width ?? 1080,
              height: variant?.height ?? 1080,
            },
          ];
        })
      );
      const referenceAssetBySize = Object.fromEntries(
        template.supportedSizes.map((size) => {
          const variant = template.manifest.variants.find((item) => item.key === size);
          const asset = variant
            ? template.manifest.assets.find((item) => item.key === variant.referenceAsset)
            : null;
          return [
            size,
            asset ? publicTemplateBundleAssetPath(template.manifest, asset.path) : "",
          ];
        })
      );
      const backgroundAssetBySize = Object.fromEntries(
        template.supportedSizes.map((size) => {
          const variant = template.manifest.variants.find((item) => item.key === size);
          const asset = variant
            ? template.manifest.assets.find((item) => item.key === variant.backgroundAsset)
            : null;
          return [
            size,
            asset ? publicTemplateBundleAssetPath(template.manifest, asset.path) : "",
          ];
        })
      );
      return {
        assignmentId: template.assignmentId,
        productId: template.productId,
        familyId: template.familyId,
        familyKey: template.familyKey,
        familyName: template.familyName,
        versionId: template.versionId,
        versionLabel: template.versionLabel,
        supportedSizes: template.supportedSizes,
        defaultVariantKey: template.defaultVariantKey,
        fieldCount: new Set(Object.values(fieldsBySize).flat()).size,
        fieldsBySize,
        variantMetaBySize,
        referenceAssetBySize,
        backgroundAssetBySize,
      };
    });
  const fetchedContentRows = (contentResult.data ?? []) as unknown as ContentRow[];
  const visibleContentRows = paginatesApprovals
    ? fetchedContentRows.slice(0, approvalPageSize)
    : fetchedContentRows;
  const content = needsContentRows
    ? visibleContentRows.map((row) => {
    const template = one(row.product_templates);
    const templateVersion = one(row.template_versions);
    const templateFamily = one(templateVersion?.template_families);
    const templateVariant = one(row.template_variants);
    const creator = one(row.creator);
    const platformTemplateLabel = [
      templateFamily?.name,
      templateVariant?.label ?? templateVariant?.variant_key,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      targetLanguage: row.target_language,
      audience: row.audience,
      templateId: row.product_template_id,
      templateVariant: template?.variant ?? (platformTemplateLabel || null),
      templateCategory: template?.category ?? null,
      templateVersionId: row.template_version_id,
      sizeKey: templateVariant?.variant_key ?? null,
      createdBy: row.created_by,
      creatorName: creator?.full_name ?? null,
      rejectionNote: row.rejection_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  })
    : [];

  const activePlatformTemplates = platformTemplates;
  const approvedClaims = claims.filter((claim) => claim.status === "approved");
  const approvals = content.filter((item) => item.status === "in_review");
  const contentStatusRows = (contentResult.data ?? []) as unknown as Array<{ status: string }>;
  const contentByStatus = paginatesApprovals
    ? { in_review: inReviewCountResult.count ?? approvals.length }
    : contentStatusRows.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
  const approvalsHasMore = paginatesApprovals && fetchedContentRows.length > approvalPageSize;
  const counts = {
    assets: (assetResult.data ?? []).length,
    approvedSources: approvedSources.length,
    approvedClaims: approvedClaims.length,
    activeTemplates: activePlatformTemplates.length,
    platformTemplates: platformTemplates.length,
    activePlatformTemplates: activePlatformTemplates.length,
    content: contentCountResult.count ?? contentStatusRows.length,
    inReview: inReviewCountResult.count ?? approvals.length,
    contentByStatus,
  };
  const permissions = getWorkspacePermissions({
    role: profile.role,
    productStatus: product.status,
    activeTemplateCount: activePlatformTemplates.length,
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
    platformTemplates,
    activePlatformTemplates,
    content,
    approvals,
    approvalsNextCursor: approvalsHasMore
      ? cursorFromOffset(approvalOffset + approvalPageSize)
      : null,
    approvalsHasMore,
    counts,
    permissions,
    sections: getWorkspaceSectionStates({
      productId,
      counts,
      permissions,
    }),
  };
}
