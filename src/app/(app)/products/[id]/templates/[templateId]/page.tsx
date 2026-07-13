import Link from "next/link";
import { notFound } from "next/navigation";
import {
  defaultSizeFor,
  originalTemplatePreviewUrl,
  SIZES,
} from "@/lib/creative";
import { getProductWorkspace } from "@/lib/product-workspace-server";
import { resolveEffectiveFieldLimits } from "@/lib/template-specs";
import { fieldLabel } from "@/lib/templates";
import { fieldLimitText } from "@/lib/template-fields";
import { GenerateVariant } from "../../generate-variant";

export default async function ProductTemplatePage({
  params,
}: {
  params: Promise<{ id: string; templateId: string }>;
}) {
  const { id, templateId } = await params;
  const workspace = await getProductWorkspace(id);
  if (!workspace) notFound();

  const template = workspace.templates.find((item) => item.id === templateId);
  if (!template) notFound();

  const { product, permissions } = workspace;
  const canGenerate =
    permissions.canGenerateContent && template.status === "active";

  const fields = template.editableFields;
  const defaultCopy = template.defaultCopy;
  const limits = resolveEffectiveFieldLimits(
    template.layoutKey,
    template.fieldLimits
  );
  const locked = template.lockedFields;
  const sizeKey = defaultSizeFor(template.category);
  const size = SIZES[sizeKey];
  const preview = originalTemplatePreviewUrl(
    template.id,
    template.layoutKey,
    sizeKey
  );

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-9 sm:px-10">
      <div className="flex flex-col gap-1.5">
        <Link
          href={`/products/${id}?view=templates`}
          className="text-[13px] font-semibold text-brand hover:underline"
        >
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

      {!canGenerate && (
        <p className="rounded-control border border-edge-strong bg-page px-4 py-3 text-[13px] text-ink-muted">
          This template is available for reference only. Generation and Studio
          require an active product and an active template.
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-5">
          <div
            className="overflow-hidden rounded-[10px] border border-edge bg-page"
            style={{ aspectRatio: `${size.w} / ${size.h}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={`${template.variant} original preview`} className="h-full w-full object-contain" />
          </div>
          <div className="flex flex-wrap gap-2">
            {canGenerate && (
              <Link
                href={`/studio?product=${id}&template=${template.id}`}
                className="flex-1 rounded-control bg-brand px-4 py-2.5 text-center text-[13.5px] font-semibold text-white"
              >
                Open in Studio
              </Link>
            )}
            <a
              href={preview}
              download
              className="rounded-control border border-edge-strong px-4 py-2.5 text-[13px] font-semibold text-ink"
            >
              Download original
            </a>
          </div>
          {template.originalFilePath && (
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
              {template.generationInstructions}
            </p>
            {canGenerate && (
              <GenerateVariant
                productId={product.id}
                templateId={template.id}
                variant={template.variant}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
