import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { defaultSizeFor, SIZES, templatePreviewUrl } from "@/lib/creative";
import { resolveEffectiveFieldLimits } from "@/lib/template-specs";
import { fieldLabel } from "@/lib/templates";
import { fieldLimitText, type FieldLimits } from "@/lib/template-fields";
import { GenerateVariant } from "../../generate-variant";

export default async function ProductTemplatePage({
  params,
}: {
  params: Promise<{ id: string; templateId: string }>;
}) {
  const { id, templateId } = await params;
  const supabase = await createClient();
  const [{ data: product }, { data: template }] = await Promise.all([
    supabase.from("products").select("id, name, description").eq("id", id).single(),
    supabase
      .from("product_templates")
      .select(
        "id, product_id, category, variant, layout_key, editable_fields, default_copy, field_limits, locked_fields, generation_instructions, original_file_path"
      )
      .eq("id", templateId)
      .eq("product_id", id)
      .single(),
  ]);
  if (!product || !template) notFound();

  const fields = (template.editable_fields ?? []) as string[];
  const defaultCopy = (template.default_copy ?? {}) as Record<string, string>;
  const limits = resolveEffectiveFieldLimits(
    template.layout_key,
    (template.field_limits ?? {}) as FieldLimits
  );
  const locked = (template.locked_fields ?? []) as string[];
  const sizeKey = defaultSizeFor(template.category);
  const size = SIZES[sizeKey];
  const preview = templatePreviewUrl(template.id, sizeKey);

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <Link href={`/products/${id}`} className="text-[13px] font-semibold text-brand hover:underline">
          ← {product.name}
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-[28px] font-semibold">{template.variant}</h1>
          <span className="rounded-[5px] bg-brand-tint px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-brand">
            {template.category.replace("_", " ")}
          </span>
        </div>
        <p className="max-w-2xl text-[14px] text-ink-muted">
          Review the approved original copy, then generate a field-by-field variation without changing the design.
        </p>
      </div>

      <div className="grid grid-cols-[1.05fr_1fr] items-start gap-6">
        <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-5">
          <div
            className="overflow-hidden rounded-[10px] border border-edge bg-page"
            style={{ aspectRatio: `${size.w} / ${size.h}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={`${template.variant} original preview`} className="h-full w-full object-contain" />
          </div>
          <div className="flex gap-2">
            <Link
              href={`/studio?product=${id}&template=${template.id}`}
              className="flex-1 rounded-control bg-brand px-4 py-2.5 text-center text-[13.5px] font-semibold text-white"
            >
              Open in Studio
            </Link>
            <a
              href={`${preview}&download=1`}
              className="rounded-control border border-edge-strong px-4 py-2.5 text-[13px] font-semibold text-ink"
            >
              Download original
            </a>
          </div>
          {template.original_file_path && (
            <p className="text-xs text-ink-faint">
              An original source file is registered for this template.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-[22px]">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold">Existing copy</h2>
              <span className="rounded-[5px] bg-approve-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-approve">
                Original
              </span>
            </div>
            {fields.map((key) => (
              <div key={key} className="flex flex-col gap-1 border-b border-edge pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-faint">
                    {fieldLabel(key)}
                  </span>
                  <span className="text-[11px] text-ink-faint">{fieldLimitText(limits[key])}</span>
                </div>
                <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink">
                  {defaultCopy[key] || "No default copy configured."}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-[22px]">
            <h2 className="text-[15px] font-bold">Locked design</h2>
            <div className="flex flex-wrap gap-2">
              {locked.map((item) => (
                <span key={item} className="rounded-full border border-edge bg-page px-3 py-1 text-[11.5px] font-semibold capitalize text-ink-muted">
                  {item}
                </span>
              ))}
            </div>
            <p className="text-[12.5px] leading-relaxed text-ink-muted">
              {template.generation_instructions}
            </p>
            <GenerateVariant templateId={template.id} variant={template.variant} />
          </div>
        </div>
      </div>
    </div>
  );
}
