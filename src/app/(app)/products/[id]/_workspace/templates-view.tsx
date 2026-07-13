import Link from "next/link";
import { fieldLabel } from "@/lib/templates";
import { originalTemplatePreviewUrl, SIZES } from "@/lib/creative";
import { defaultTemplateSize } from "@/lib/template-contract";
import type {
  ProductWorkspace,
  ProductWorkspaceTemplate,
} from "@/lib/product-workspace-server";
import { GenerateVariant } from "../generate-variant";
import { SectionEmpty } from "./empty-state";

const CATEGORY_LABELS: Record<string, string> = {
  social: "Social",
  flyer: "Flyer",
  one_pager: "One-pager",
  email: "Email",
  presentation: "Presentation",
};

export function TemplatesView({ workspace }: { workspace: ProductWorkspace }) {
  const { product, activeTemplates, permissions, sections } = workspace;
  const canGenerate = permissions.canGenerateContent;
  const isArchived = product.status === "archived";

  if (activeTemplates.length === 0) {
    return (
      <SectionEmpty
        code="configure_template"
        actionHref={sections.templates.actionHref}
        actionLabel={sections.templates.canAct ? "Configure a template" : undefined}
      />
    );
  }

  const byCategory = new Map<string, ProductWorkspaceTemplate[]>();
  for (const t of activeTemplates) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category)!.push(t);
  }

  return (
    <div className="flex flex-col gap-5">
      {isArchived ? (
        <p className="rounded-control border border-edge-strong bg-page px-4 py-3 text-[13px] text-ink-muted">
          This product is archived. Templates stay visible for reference, but new
          content generation and Studio are disabled.
        </p>
      ) : (
        <p className="text-[13px] text-ink-muted">
          Choose a template variant. Each variant guides how content is written,
          using only this product&apos;s approved knowledge.
          {!canGenerate &&
            " Generation is unavailable until an active template is configured."}
        </p>
      )}

      {[...byCategory.entries()].map(([category, variants]) => (
        <div
          key={category}
          className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-[22px]"
        >
          <h2 className="text-[15px] font-bold">
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {variants.map((t) => {
              const sizeKey = defaultTemplateSize({
                layoutKey: t.layoutKey,
                category: t.category,
                definition: t.templateDefinition,
                status: t.status,
              });
              const dims = SIZES[sizeKey];
              const previewSrc = originalTemplatePreviewUrl(
                t.id,
                t.layoutKey,
                sizeKey
              );
              return (
                <div
                  key={t.id}
                  className="flex flex-col gap-2.5 rounded-control border border-edge bg-surface p-3"
                >
                  <div
                    className="overflow-hidden rounded-[8px] border border-edge bg-brand-tint"
                    style={{ aspectRatio: `${dims.w} / ${dims.h}` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewSrc}
                      alt={`${t.variant} template preview`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex items-center gap-2 px-0.5">
                    <span className="min-w-0 truncate text-[13px] font-semibold">
                      {t.variant}
                    </span>
                    <span className="shrink-0 whitespace-nowrap rounded-[5px] bg-brand-tint px-[6px] py-0.5 text-[9.5px] font-bold uppercase tracking-[0.05em] text-brand">
                      {t.editableFields.length} fields
                    </span>
                  </div>
                  <p className="line-clamp-1 px-0.5 text-[11px] text-ink-faint">
                    {t.editableFields.map((fk) => fieldLabel(fk)).join(" · ")}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 px-0.5">
                    <Link
                      href={`/products/${product.id}/templates/${t.id}`}
                      className="whitespace-nowrap rounded-control border border-edge-strong px-3 py-2 text-[12px] font-semibold text-ink-muted hover:border-brand hover:text-brand"
                    >
                      View template
                    </Link>
                    {canGenerate && (
                      <GenerateVariant
                        productId={product.id}
                        templateId={t.id}
                        variant={t.variant}
                        compact
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
