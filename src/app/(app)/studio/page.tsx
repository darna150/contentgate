import { createClient } from "@/lib/supabase/server";
import { stripInternalTemplateDefinition } from "@/lib/published-template-package";
import {
  isTemplateContractReady,
  TEMPLATE_OUTPUT_SIZES,
  type TemplateSizeKey,
} from "@/lib/template-contract";
import { resolveEffectiveFieldLimits } from "@/lib/template-specs";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import {
  getTemplateBundleSupportedSizes,
  resolveTemplateBundleRuntimeVariant,
} from "@/lib/template-platform/runtime";
import { createTemplateBundleAssetUrlMap } from "@/lib/template-platform/storage-urls";
import { StudioEditor } from "./studio-editor";

type Product = { id: string; name: string; disclaimer_text: string | null };
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
    { data: templateRows },
    { data: platformAssignmentRows },
    { data: organization },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, disclaimer_text")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("product_templates")
      .select("id, product_id, category, variant, layout_key, editable_fields, default_copy, field_limits, locked_fields, template_definition")
      .eq("status", "active")
      .order("sort_order"),
    supabase
      .from("product_template_assignments")
      .select(
        "id, product_id, status, default_variant_key, default_payload, template_families(family_key, name), template_versions(id, version_label, status, manifest)"
      )
      .eq("status", "active"),
    supabase.from("organizations").select("name").single(),
  ]);

  const products = (productRows ?? []) as Product[];
  const legacyTemplates = ((templateRows ?? []) as Template[])
    .map((template) => ({
      ...template,
      field_limits: resolveEffectiveFieldLimits(template.layout_key, template.field_limits),
    }))
    .filter((template) => {
      const ready = isTemplateContractReady({
        layoutKey: template.layout_key,
        category: template.category,
        editableFields: template.editable_fields,
        fieldLimits: template.field_limits,
        lockedFields: template.locked_fields,
        definition: template.template_definition,
        status: "active",
      });
      if (!ready) {
        console.error("Active template failed the engine contract:", template.id);
      }
      return ready;
    })
    .map((template) => ({
      ...template,
      template_definition: stripInternalTemplateDefinition(
        template.template_definition
      ),
    }));
  const normalizedPlatformAssignmentRows = (platformAssignmentRows ?? []) as PlatformAssignmentRow[];
  const platformTemplates = platformAssignmentsToTemplates(normalizedPlatformAssignmentRows);
  const templates = [...platformTemplates, ...legacyTemplates];

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
    initialContent = {
      id: requestedContent.id,
      title: requestedContent.title,
      status: requestedContent.status,
      structured_fields: (requestedContent.structured_fields ?? {}) as Record<string, string>,
      outputSize: isSizeKey(
        (requestedContent.prompt_context as { output_size?: unknown } | null)?.output_size
      )
        ? ((requestedContent.prompt_context as { output_size: TemplateSizeKey }).output_size)
        : null,
      canEdit: requestedContent.created_by === user?.id,
      manuallyEdited:
        Array.isArray(
          (requestedContent.prompt_context as { manually_edited_fields?: unknown[] } | null)
            ?.manually_edited_fields
        ) &&
        (requestedContent.prompt_context as { manually_edited_fields?: unknown[] })
          .manually_edited_fields!.length > 0,
    };
  }

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
          initialContent={initialContent}
          initialSize={initialContent?.outputSize ?? requestedSize}
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
