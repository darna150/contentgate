import { createClient } from "@/lib/supabase/server";
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
};

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; template?: string; content?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const [{ data: productRows }, { data: templateRows }, { data: organization }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, disclaimer_text")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("product_templates")
      .select("id, product_id, category, variant, layout_key, editable_fields, default_copy, field_limits")
      .eq("status", "active")
      .order("sort_order"),
    supabase.from("organizations").select("name").single(),
  ]);

  const products = (productRows ?? []) as Product[];
  const templates = ((templateRows ?? []) as Template[]).map((template) => ({
    ...template,
    field_limits: resolveEffectiveFieldLimits(template.layout_key, template.field_limits),
  }));
  const selectedProduct =
    products.find((product) => product.id === query.product) ?? products[0] ?? null;
  const productTemplates = templates.filter(
    (template) => template.product_id === selectedProduct?.id
  );
  const selectedTemplate =
    productTemplates.find((template) => template.id === query.template) ??
    productTemplates[0] ??
    null;

  let initialContent: {
    id: string;
    title: string;
    status: string;
    structured_fields: Record<string, string>;
    manuallyEdited: boolean;
  } | null = null;
  if (query.content && selectedTemplate) {
    const { data } = await supabase
      .from("generated_content")
      .select(
        "id, title, status, structured_fields, prompt_context, product_template_id"
      )
      .eq("id", query.content)
      .eq("product_template_id", selectedTemplate.id)
      .single();
    if (data) {
      initialContent = {
        id: data.id,
        title: data.title,
        status: data.status,
        structured_fields: (data.structured_fields ?? {}) as Record<string, string>,
        manuallyEdited:
          Array.isArray(
            (data.prompt_context as { manually_edited_fields?: unknown[] } | null)
              ?.manually_edited_fields
          ) &&
          (
            data.prompt_context as { manually_edited_fields?: unknown[] }
          ).manually_edited_fields!.length > 0,
      };
    }
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
