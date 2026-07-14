import { createClient } from "@/lib/supabase/server";
import { stripInternalTemplateDefinition } from "@/lib/published-template-package";
import {
  isTemplateContractReady,
  TEMPLATE_OUTPUT_SIZES,
  type TemplateSizeKey,
} from "@/lib/template-contract";
import { resolveEffectiveFieldLimits } from "@/lib/template-specs";
import { StudioEditor } from "./studio-editor";

type Product = { id: string; name: string; disclaimer_text: string | null };
type Template = {
  id: string;
  product_id: string;
  category: string;
  variant: string;
  layout_key: string;
  editable_fields: string[];
  default_copy: Record<string, string>;
  field_limits: Record<string, { max_chars?: number; max_words?: number; max_lines?: number }>;
  locked_fields: string[];
  template_definition: Record<string, unknown>;
};

function isSizeKey(value: unknown): value is TemplateSizeKey {
  return typeof value === "string" && value in TEMPLATE_OUTPUT_SIZES;
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
  const [{ data: productRows }, { data: templateRows }, { data: organization }] = await Promise.all([
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
    supabase.from("organizations").select("name").single(),
  ]);

  const products = (productRows ?? []) as Product[];
  const templates = ((templateRows ?? []) as Template[])
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
    requestedContent?.product_template_id ?? query.template;
  const selectedProduct =
    products.find((product) => product.id === requestedProductId) ?? products[0] ?? null;
  const productTemplates = templates.filter(
    (template) => template.product_id === selectedProduct?.id
  );
  const selectedTemplate =
    productTemplates.find((template) => template.id === requestedTemplateId) ??
    productTemplates[0] ??
    null;

  let initialContent: {
    id: string;
    title: string;
    status: string;
    structured_fields: Record<string, string>;
    outputSize: TemplateSizeKey | null;
    manuallyEdited: boolean;
    canEdit: boolean;
  } | null = null;
  if (
    requestedContent &&
    selectedProduct &&
    selectedTemplate &&
    requestedContent.product_id === selectedProduct.id &&
    requestedContent.product_template_id === selectedTemplate.id
  ) {
      initialContent = {
        id: requestedContent.id,
        title: requestedContent.title,
        status: requestedContent.status,
        structured_fields: (requestedContent.structured_fields ?? {}) as Record<string, string>,
        outputSize: isSizeKey(
          (requestedContent.prompt_context as { output_size?: unknown } | null)
            ?.output_size
        )
          ? ((requestedContent.prompt_context as { output_size: TemplateSizeKey })
              .output_size)
          : null,
        canEdit: requestedContent.created_by === user?.id,
        manuallyEdited:
          Array.isArray(
            (requestedContent.prompt_context as { manually_edited_fields?: unknown[] } | null)
              ?.manually_edited_fields
          ) &&
          (
            requestedContent.prompt_context as { manually_edited_fields?: unknown[] }
          ).manually_edited_fields!.length > 0,
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
