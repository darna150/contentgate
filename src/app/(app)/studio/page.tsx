import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_OUTPUT_SIZES, type TemplateSizeKey } from "@/lib/template-contract";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import {
  getTemplateBundleSupportedSizes,
  resolveTemplateBundleRuntimeVariant,
} from "@/lib/template-platform/runtime";
import { createTemplateBundleAssetUrlMap } from "@/lib/template-platform/storage-urls";
import { StudioEditor } from "./studio-editor";

type Product = { id: string; name: string; disclaimer_text: string | null };
type StudioContent = {
  id: string;
  title: string;
  status: string;
  structured_fields: Record<string, string>;
  outputSize: TemplateSizeKey | null;
  manuallyEdited: boolean;
  canEdit: boolean;
};
type Template = {
  id: string;
  product_id: string;
  category: string;
  variant: string;
  layout_key: string;
  platformAssignmentId?: string;
  platformAssetUrlByPath?: Record<string, string>;
  platformManifest?: TemplateBundleManifest;
  editable_fields: string[];
  default_copy: Record<string, string>;
  field_limits: Record<string, { max_chars?: number; max_words?: number; max_lines?: number }>;
  locked_fields: string[];
  template_definition: Record<string, unknown>;
};

type PlatformAssignmentRow = {
  id: string;
  product_id: string;
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
  updated_at?: string | null;
};

function isSizeKey(value: unknown): value is TemplateSizeKey {
  return typeof value === "string" && value in TEMPLATE_OUTPUT_SIZES;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function platformTemplateId(assignmentId: string) {
  return `platform:${assignmentId}`;
}

function contentOutputSize(row: Pick<GeneratedContentRow, "prompt_context">) {
  const outputSize = row.prompt_context?.output_size;
  return isSizeKey(outputSize) ? outputSize : null;
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
    canEdit: row.created_by === userId,
    manuallyEdited: contentWasManuallyEdited(row),
  };
}

function platformAssignmentsToTemplates(rows: PlatformAssignmentRow[]): Template[] {
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
        id: platformTemplateId(row.id),
        product_id: row.product_id,
        category: "social",
        variant: `${family.name} · Platform v1`,
        layout_key: `template-platform:${family.family_key}`,
        platformAssignmentId: row.id,
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

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; template?: string; content?: string; size?: string }>;
}) {
  const query = await searchParams;
  const requestedSize = isSizeKey(query.size) ? query.size : null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [
    { data: productRows },
    { data: platformAssignmentRows },
    { data: organization },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, disclaimer_text")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("product_template_assignments")
      .select(
        "id, product_id, status, default_variant_key, default_payload, template_families(family_key, name), template_versions(id, version_label, status, manifest)"
      )
      .eq("status", "active"),
    supabase.from("organizations").select("name").single(),
  ]);

  const products = (productRows ?? []) as Product[];
  const normalizedPlatformAssignmentRows = (platformAssignmentRows ?? []) as PlatformAssignmentRow[];
  const platformTemplates = platformAssignmentsToTemplates(normalizedPlatformAssignmentRows);
  const templates = platformTemplates;

  const { data: requestedContent } = query.content
    ? await supabase
        .from("generated_content")
        .select(
          "id, title, status, structured_fields, prompt_context, created_by, product_id, product_template_id"
        )
        .eq("id", query.content)
        .single()
    : { data: null };

  // A saved content record is the canonical product/template context. This
  // keeps content deep links from silently falling back to Studio defaults.
  const requestedProductId = requestedContent?.product_id ?? query.product;
  const requestedTemplateId =
    requestedContent?.product_template_id ??
    (typeof (requestedContent?.prompt_context as { platform_assignment_id?: unknown } | null)
      ?.platform_assignment_id === "string"
      ? platformTemplateId(
          (requestedContent?.prompt_context as { platform_assignment_id: string })
            .platform_assignment_id
        )
      : query.template);
  const selectedProduct =
    products.find((product) => product.id === requestedProductId) ?? products[0] ?? null;
  const productTemplates = templates.filter(
    (template) => template.product_id === selectedProduct?.id
  );
  let selectedTemplate =
    productTemplates.find((template) => template.id === requestedTemplateId) ??
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
  const requestedPlatformAssignmentId =
    typeof (requestedContent?.prompt_context as { platform_assignment_id?: unknown } | null)
      ?.platform_assignment_id === "string"
      ? ((requestedContent?.prompt_context as { platform_assignment_id: string })
          .platform_assignment_id)
      : null;
  const requestedContentMatchesSelectedTemplate =
    Boolean(
      requestedContent &&
        selectedTemplate &&
        requestedContent.product_id === selectedProduct?.id &&
        (requestedContent.product_template_id === selectedTemplate.id ||
          (selectedTemplate.platformAssignmentId &&
            requestedPlatformAssignmentId === selectedTemplate.platformAssignmentId))
    );

  let initialContent: {
    id: string;
    title: string;
    status: string;
    structured_fields: Record<string, string>;
    outputSize: TemplateSizeKey | null;
    manuallyEdited: boolean;
    canEdit: boolean;
  } | null = null;
  if (requestedContentMatchesSelectedTemplate && requestedContent) {
    initialContent = toStudioContent(
      requestedContent as GeneratedContentRow,
      user?.id
    );
  }

  const { data: selectedContentRows } =
    selectedProduct && selectedTemplate
      ? await supabase
          .from("generated_content")
          .select(
            "id, title, status, structured_fields, prompt_context, created_by, product_id, product_template_id, updated_at"
          )
          .eq("product_id", selectedProduct.id)
          .in("status", ["draft", "rejected", "in_review", "approved"])
          .order("updated_at", { ascending: false })
          .limit(100)
      : { data: [] };
  const initialContentsBySize = new Map<TemplateSizeKey, StudioContent>();
  const selectedContentCandidates = [
    ...(requestedContentMatchesSelectedTemplate && requestedContent
      ? [requestedContent as GeneratedContentRow]
      : []),
    ...(((selectedContentRows ?? []) as GeneratedContentRow[]).filter((row) => {
      if (row.product_id !== selectedProduct?.id) return false;
      if (selectedTemplate?.platformAssignmentId) {
        return (
          row.prompt_context?.platform_assignment_id ===
          selectedTemplate.platformAssignmentId
        );
      }
      return row.product_template_id === selectedTemplate?.id;
    })),
  ];
  for (const row of selectedContentCandidates) {
    const item = toStudioContent(row, user?.id);
    if (!item.outputSize || initialContentsBySize.has(item.outputSize)) continue;
    initialContentsBySize.set(item.outputSize, item);
  }
  const initialContents = [...initialContentsBySize.values()];
  const preferredInitialContent =
    initialContent ??
    (requestedSize
      ? (initialContentsBySize.get(requestedSize) ?? null)
      : (initialContents[0] ?? null));

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-semibold">Creative Studio</h1>
        <p className="text-[14.5px] text-ink-muted">
          Choose a product and approved template, compare its original copy, and generate a fitted variation inside the locked design.
        </p>
      </div>
      {selectedProduct && selectedTemplate ? (
        <StudioEditor
          key={selectedTemplate.id}
          products={products}
          templates={templates}
          selectedProduct={selectedProduct}
          selectedTemplate={selectedTemplate}
          initialContents={initialContents}
          initialSize={preferredInitialContent?.outputSize ?? requestedSize}
          organizationName={organization?.name ?? "Current workspace"}
        />
      ) : (
        <div className="rounded-card border border-dashed border-edge-strong bg-surface px-8 py-16 text-center text-sm text-ink-muted">
          Add an active product and template to begin using Studio.
        </div>
      )}
    </div>
  );
}
