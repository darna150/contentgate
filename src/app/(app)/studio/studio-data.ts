import "server-only";

import {
  canEditContent,
  canReviewContent,
  type ContentRole,
  type ContentStatus,
} from "@/lib/content-governance";
import { createClient } from "@/lib/supabase/server";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import {
  getTemplateBundleSupportedSizes,
  getTemplateBundleVariantDimensions,
  getTemplateBundleVariantLabel,
  resolveTemplateBundleRuntimeVariant,
} from "@/lib/template-platform/runtime";
import { createTemplateBundleAssetUrlMap } from "@/lib/template-platform/storage-urls";
import type { FieldLimits } from "@/lib/template-fields";

export type StudioProduct = {
  id: string;
  name: string;
  disclaimer_text: string | null;
};

export type StudioContent = {
  id: string;
  title: string;
  status: string;
  structured_fields: Record<string, string>;
  outputSize: string | null;
  manuallyEdited: boolean;
  canEdit: boolean;
  updatedAt: string | null;
};

export type StudioTemplate = {
  id: string;
  product_id: string;
  category: string;
  variant: string;
  layout_key: string;
  platformAssignmentId?: string;
  templateVersionId?: string;
  platformAssetUrlByPath?: Record<string, string>;
  platformManifest?: TemplateBundleManifest;
  editable_fields: string[];
  default_copy: Record<string, string>;
  field_limits: FieldLimits;
  locked_fields: string[];
  template_definition: Record<string, unknown>;
};

export type StudioContentContext = {
  content: StudioContent;
  product: StudioProduct;
  assignment: StudioTemplate;
  manifest: TemplateBundleManifest;
  variantKey: string;
  sizeLabel: string;
  dims: { w: number; h: number };
  canEdit: boolean;
  status: string;
};

export type StudioState = {
  products: StudioProduct[];
  templates: StudioTemplate[];
  selectedProduct: StudioProduct | null;
  selectedTemplate: StudioTemplate | null;
  initialContents: StudioContent[];
  initialSize: string | null;
  organizationName: string;
  // Static per-viewer flag (role-based, not content-specific) that the
  // review-mode UI uses to decide whether to show approve/reject actions.
  canReview: boolean;
  // Every generation for this product+template, bucketed by size and sorted
  // newest-first — the version rail's data source. Built from the same
  // selectedContentRows query already run below (no extra round trip).
  versionsBySize: Record<string, StudioContent[]>;
};

type PlatformAssignmentRow = {
  id: string;
  product_id: string;
  template_version_id: string | null;
  status: string;
  default_variant_key: string | null;
  default_payload: Record<string, string> | null;
  template_families:
    | { family_key: string; name: string }
    | { family_key: string; name: string }[]
    | null;
  template_versions:
    | {
        id: string;
        version_label: string;
        status: string;
        manifest: TemplateBundleManifest;
      }
    | {
        id: string;
        version_label: string;
        status: string;
        manifest: TemplateBundleManifest;
      }[]
    | null;
};

type GeneratedContentRow = {
  id: string;
  title: string;
  status: string;
  structured_fields: Record<string, string> | null;
  prompt_context: Record<string, unknown> | null;
  created_by: string;
  product_id: string;
  product_template_id: string | null;
  template_version_id?: string | null;
  template_variant_id?: string | null;
  template_variants?:
    | { variant_key: string; label?: string | null }
    | { variant_key: string; label?: string | null }[]
    | null;
  products?: StudioProduct | StudioProduct[] | null;
  updated_at?: string | null;
};

const CONTENT_SELECT =
  "id, title, status, structured_fields, prompt_context, created_by, product_id, product_template_id, template_version_id, template_variant_id, template_variants(variant_key, label), updated_at";

const ACTIVE_CONTENT_STATUSES = ["draft", "rejected", "in_review", "approved"];

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function normalizePlatformAssignmentId(value: string | null | undefined) {
  if (!value) return null;
  return value.startsWith("platform:") ? value.slice("platform:".length) : value;
}

function promptAssignmentId(row: Pick<GeneratedContentRow, "prompt_context">) {
  const value = row.prompt_context?.platform_assignment_id;
  return typeof value === "string" ? value : null;
}

function contentOutputSize(
  row: Pick<GeneratedContentRow, "prompt_context" | "template_variants">
) {
  const variant = one(row.template_variants);
  if (typeof variant?.variant_key === "string") return variant.variant_key;
  const outputSize = row.prompt_context?.output_size;
  return typeof outputSize === "string" ? outputSize : null;
}

function contentWasManuallyEdited(row: Pick<GeneratedContentRow, "prompt_context">) {
  return (
    Array.isArray(row.prompt_context?.manually_edited_fields) &&
    row.prompt_context.manually_edited_fields.length > 0
  );
}

function toStudioContent(row: GeneratedContentRow, userId?: string): StudioContent {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    structured_fields: (row.structured_fields ?? {}) as Record<string, string>,
    outputSize: contentOutputSize(row),
    canEdit: userId
      ? canEditContent({
          userId,
          authorId: row.created_by,
          status: row.status as ContentStatus,
        })
      : false,
    manuallyEdited: contentWasManuallyEdited(row),
    updatedAt: row.updated_at ?? null,
  };
}

function platformAssignmentsToTemplates(rows: PlatformAssignmentRow[]): StudioTemplate[] {
  return rows.flatMap((row) => {
    if (row.status !== "active") return [];
    const family = one(row.template_families);
    const version = one(row.template_versions);
    if (!family || !version || version.status !== "published") return [];
    const supportedSizes = getTemplateBundleSupportedSizes(version.manifest);
    const defaultVariantKey = row.default_variant_key ?? supportedSizes[0];
    if (!defaultVariantKey) return [];
    const runtime = resolveTemplateBundleRuntimeVariant(version.manifest, defaultVariantKey);
    if (!runtime) return [];
    const defaultCopy = row.default_payload ?? {};
    return [
      {
        id: row.id,
        product_id: row.product_id,
        category: "social",
        variant: family.name,
        layout_key: `template-platform:${family.family_key}`,
        platformAssignmentId: row.id,
        templateVersionId: version.id,
        platformManifest: version.manifest,
        editable_fields: runtime.fields.map((field) => field.key),
        default_copy: Object.fromEntries(
          runtime.fields.map((field) => [field.key, String(defaultCopy[field.key] ?? "")])
        ),
        field_limits: runtime.fieldLimits,
        locked_fields: [],
        template_definition: {
          platform: true,
          templateVersionId: version.id,
          versionLabel: version.version_label,
        },
      },
    ];
  });
}

async function listActiveAssignments() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_template_assignments")
    .select(
      "id, product_id, template_version_id, status, default_variant_key, default_payload, template_families(family_key, name), template_versions(id, version_label, status, manifest)"
    )
    .eq("status", "active");
  return (data ?? []) as PlatformAssignmentRow[];
}

async function findAssignmentForContent(content: GeneratedContentRow) {
  const supabase = await createClient();
  const assignmentId = promptAssignmentId(content);

  let query = supabase
    .from("product_template_assignments")
    .select(
      "id, product_id, template_version_id, status, default_variant_key, default_payload, template_families(family_key, name), template_versions(id, version_label, status, manifest)"
    )
    .eq("status", "active")
    .limit(1);

  if (assignmentId) {
    query = query.eq("id", assignmentId);
  } else if (content.template_version_id) {
    query = query
      .eq("product_id", content.product_id)
      .eq("template_version_id", content.template_version_id);
  } else {
    return null;
  }

  const { data } = await query.maybeSingle();
  return (data ?? null) as PlatformAssignmentRow | null;
}

export async function getStudioContent(
  contentId: string
): Promise<StudioContentContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("generated_content")
    .select(`${CONTENT_SELECT}, products(id, name, disclaimer_text)`)
    .eq("id", contentId)
    .maybeSingle();

  if (!data) return null;
  const row = data as GeneratedContentRow;
  const product = one(row.products);
  if (!product) return null;
  const assignmentRow = await findAssignmentForContent(row);
  if (!assignmentRow) return null;
  const [assignment] = platformAssignmentsToTemplates([assignmentRow]);
  if (!assignment?.platformManifest) return null;
  const variantKey = contentOutputSize(row) ?? defaultVariantKey(assignment.platformManifest);
  const dims = variantDimensions(assignment.platformManifest, variantKey);
  const sizeLabel = getTemplateBundleVariantLabel(assignment.platformManifest, variantKey);
  const content = toStudioContent(row, user?.id);

  return {
    content,
    product,
    assignment,
    manifest: assignment.platformManifest,
    variantKey,
    sizeLabel,
    dims,
    canEdit: content.canEdit,
    status: content.status,
  };
}

export async function listSizeVersions(
  assignmentId: string,
  variantId: string,
  limit = 20
): Promise<StudioContent[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: assignment } = await supabase
    .from("product_template_assignments")
    .select("product_id, template_version_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment?.product_id || !assignment.template_version_id) return [];

  const { data } = await supabase
    .from("generated_content")
    .select(CONTENT_SELECT)
    .eq("product_id", assignment.product_id)
    .eq("template_version_id", assignment.template_version_id)
    .eq("template_variant_id", variantId)
    .in("status", ACTIVE_CONTENT_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as GeneratedContentRow[]).map((row) =>
    toStudioContent(row, user?.id)
  );
}

function defaultVariantKey(manifest: TemplateBundleManifest) {
  return getTemplateBundleSupportedSizes(manifest)[0] ?? "square";
}

function variantDimensions(manifest: TemplateBundleManifest, variantKey: string) {
  const dims = getTemplateBundleVariantDimensions(manifest, variantKey);
  if (dims) return dims;
  return getTemplateBundleVariantDimensions(manifest, defaultVariantKey(manifest)) ?? {
    w: 1080,
    h: 1080,
  };
}

export async function loadStudioState(input: {
  contentId?: string | null;
  productId?: string | null;
  assignmentId?: string | null;
  size?: string | null;
}): Promise<StudioState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [
    requestedContentContext,
    { data: productRows },
    assignmentRows,
    { data: organization },
    { data: profile },
  ] = await Promise.all([
    input.contentId ? getStudioContent(input.contentId) : Promise.resolve(null),
    supabase
      .from("products")
      .select("id, name, disclaimer_text")
      .eq("status", "active")
      .order("name"),
    listActiveAssignments(),
    supabase.from("organizations").select("name").single(),
    user
      ? supabase.from("profiles").select("role").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
  ]);

  const canReview = canReviewContent((profile?.role as ContentRole) ?? "member");
  const products = (productRows ?? []) as StudioProduct[];
  const templates = platformAssignmentsToTemplates(assignmentRows);
  const requestedProductId = requestedContentContext?.product.id ?? input.productId;
  const requestedAssignmentId =
    requestedContentContext?.assignment.id ?? normalizePlatformAssignmentId(input.assignmentId);
  const selectedProduct =
    products.find((product) => product.id === requestedProductId) ?? products[0] ?? null;
  const productTemplates = templates.filter(
    (template) => template.product_id === selectedProduct?.id
  );
  let selectedTemplate =
    productTemplates.find((template) => template.id === requestedAssignmentId) ??
    productTemplates[0] ??
    null;

  if (selectedTemplate?.platformManifest) {
    selectedTemplate = {
      ...selectedTemplate,
      platformAssetUrlByPath: Object.fromEntries(
        await createTemplateBundleAssetUrlMap(supabase, [selectedTemplate.platformManifest])
      ),
    };
  }

  let selectedContentRows: GeneratedContentRow[] = [];
  if (selectedProduct && selectedTemplate?.templateVersionId) {
    const { data } = await supabase
      .from("generated_content")
      .select(CONTENT_SELECT)
      .eq("product_id", selectedProduct.id)
      .eq("template_version_id", selectedTemplate.templateVersionId)
      .in("status", ACTIVE_CONTENT_STATUSES)
      .order("updated_at", { ascending: false })
      .limit(100);
    selectedContentRows = (data ?? []) as GeneratedContentRow[];
  }

  const initialContentsBySize = new Map<string, StudioContent>();
  const requestedRow =
    requestedContentContext?.content && requestedContentContext.assignment.id === selectedTemplate?.id
      ? requestedContentContext.content
      : null;
  if (requestedRow?.outputSize) {
    initialContentsBySize.set(requestedRow.outputSize, requestedRow);
  }
  for (const row of selectedContentRows) {
    const item = toStudioContent(row, user?.id);
    if (!item.outputSize || initialContentsBySize.has(item.outputSize)) continue;
    initialContentsBySize.set(item.outputSize, item);
  }

  const versionsBySize = new Map<string, StudioContent[]>();
  for (const row of selectedContentRows) {
    const item = toStudioContent(row, user?.id);
    if (!item.outputSize) continue;
    const list = versionsBySize.get(item.outputSize) ?? [];
    list.push(item);
    versionsBySize.set(item.outputSize, list);
  }
  if (requestedRow?.outputSize) {
    const list = versionsBySize.get(requestedRow.outputSize) ?? [];
    if (!list.some((item) => item.id === requestedRow.id)) {
      versionsBySize.set(requestedRow.outputSize, [requestedRow, ...list]);
    }
  }

  const initialContents = [...initialContentsBySize.values()];
  const initialSize =
    requestedContentContext?.variantKey ?? input.size ?? initialContents[0]?.outputSize ?? null;

  return {
    products,
    templates,
    selectedProduct,
    selectedTemplate,
    initialContents,
    initialSize,
    organizationName: organization?.name ?? "Current workspace",
    canReview,
    versionsBySize: Object.fromEntries(versionsBySize),
  };
}
