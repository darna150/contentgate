import { SIZES } from "@/lib/creative";
import type { ProductWorkspace } from "@/lib/product-workspace-server";
import { GenerateVariant } from "../generate-variant";
import { SectionEmpty } from "./empty-state";

function imageSrc(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) {
    return path;
  }
  return `/${path}`;
}

export function TemplatesView({ workspace }: { workspace: ProductWorkspace }) {
  const { product, activePlatformTemplates, permissions, sections } = workspace;
  const canGenerate = permissions.canGenerateContent;
  const isArchived = product.status === "archived";

  if (activePlatformTemplates.length === 0) {
    return (
      <SectionEmpty
        code="configure_template"
        actionHref={sections.templates.actionHref}
        actionLabel={sections.templates.canAct ? "Configure a template" : undefined}
      />
    );
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

      {activePlatformTemplates.length > 0 && (
        <div className="flex flex-col gap-3 rounded-card border border-brand/25 bg-brand-tint/40 p-[22px]">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-bold">Approved templates</h2>
            <span className="rounded-[5px] bg-approve-tint px-[6px] py-0.5 text-[9.5px] font-bold uppercase tracking-[0.05em] text-approve">
              Locked design
            </span>
          </div>
          <p className="text-[12px] leading-relaxed text-ink-muted">
            Choose a format first, then generate copy inside approved artwork
            and editable text fields.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {activePlatformTemplates.map((template) => {
              const previewPath =
                template.referenceAssetBySize[template.defaultVariantKey] ?? "";
              const dims = SIZES[template.defaultVariantKey as keyof typeof SIZES];
              return (
                <div
                  key={template.assignmentId}
                  className="flex flex-col gap-2.5 rounded-control border border-brand/20 bg-surface p-3"
                >
                  {previewPath && dims ? (
                    <div
                      className="overflow-hidden rounded-[8px] border border-edge bg-brand-tint"
                      style={{ aspectRatio: `${dims.w} / ${dims.h}` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageSrc(previewPath)}
                        alt={`${template.familyName} template preview`}
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 px-0.5">
                    <span className="min-w-0 truncate text-[13px] font-semibold">
                      {template.familyName}
                    </span>
                    <span className="shrink-0 whitespace-nowrap rounded-[5px] bg-brand-tint px-[6px] py-0.5 text-[9.5px] font-bold uppercase tracking-[0.05em] text-brand">
                      {template.fieldCount} fields
                    </span>
                  </div>
                  <p className="line-clamp-1 px-0.5 text-[11px] text-ink-faint">
                    {template.supportedSizes.join(" · ")}
                  </p>
                  <p className="px-0.5 text-[11px] text-ink-muted">
                    Locked design · generate only the size you need.
                  </p>
                  {canGenerate && (
                    <div className="px-0.5">
                      <GenerateVariant
                        productId={product.id}
                        platformAssignmentId={template.assignmentId}
                        variant={template.familyName}
                        sizes={template.supportedSizes as (keyof typeof SIZES)[]}
                        initialSize={template.defaultVariantKey as keyof typeof SIZES}
                        compact
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
