import { Badge } from "@/components/ui/badge";
import { SizeChip, type SizeChipStatus } from "@/components/size-chip";
import type { ProductWorkspace, ProductWorkspacePlatformTemplate } from "@/lib/product-workspace-server";
import { GenerateVariant } from "../generate-variant";
import { SectionEmpty } from "./empty-state";

function imageSrc(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) {
    return path;
  }
  return `/${path}`;
}

function toSizeChipStatus(status: string): SizeChipStatus {
  if (status === "approved") return "approved";
  if (status === "in_review") return "in_review";
  return "draft";
}

function buildSizeStatusMap(content: ProductWorkspace["content"]) {
  const map: Record<string, Record<string, SizeChipStatus>> = {};
  for (const item of content) {
    if (!item.templateVersionId || !item.sizeKey) continue;
    const bucket = map[item.templateVersionId] ?? (map[item.templateVersionId] = {});
    // Content is ordered newest-updated first, so the first hit per size is current.
    if (bucket[item.sizeKey]) continue;
    bucket[item.sizeKey] = toSizeChipStatus(item.status);
  }
  return map;
}

function TemplateCard({
  template,
  canGenerate,
  sizeStatus,
}: {
  template: ProductWorkspacePlatformTemplate;
  canGenerate: boolean;
  sizeStatus: Record<string, SizeChipStatus>;
}) {
  const previewPath = template.referenceAssetBySize[template.defaultVariantKey] ?? "";
  const dims = template.variantMetaBySize[template.defaultVariantKey];

  return (
    <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-3 transition-colors hover:border-brand/40">
      {previewPath ? (
        <div
          className="overflow-hidden rounded-[8px] border border-edge bg-brand-tint"
          style={{ aspectRatio: dims ? `${dims.width} / ${dims.height}` : "1 / 1" }}
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
        <span className="min-w-0 truncate text-[14px] font-bold text-ink">
          {template.familyName}
        </span>
        <Badge variant="approve" className="shrink-0">
          Locked design
        </Badge>
      </div>

      <div className="flex flex-wrap gap-1.5 px-0.5">
        {template.supportedSizes.map((size) => (
          <SizeChip
            key={size}
            label={template.variantMetaBySize[size]?.label ?? size}
            dims={
              template.variantMetaBySize[size]
                ? {
                    w: template.variantMetaBySize[size].width,
                    h: template.variantMetaBySize[size].height,
                  }
                : undefined
            }
            status={sizeStatus[size] ?? "empty"}
          />
        ))}
      </div>

      {canGenerate && (
        <div className="px-0.5">
          <GenerateVariant
            platformAssignmentId={template.assignmentId}
            variant={template.familyName}
            sizes={template.supportedSizes}
            initialSize={template.defaultVariantKey}
            compact
          />
        </div>
      )}
    </div>
  );
}

export function TemplatesView({ workspace }: { workspace: ProductWorkspace }) {
  const { product, activePlatformTemplates, permissions, sections, content } = workspace;
  const canGenerate = permissions.canGenerateContent;
  const isArchived = product.status === "archived";
  const sizeStatusByTemplate = buildSizeStatusMap(content);

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
    <div className="flex flex-col gap-4">
      {isArchived ? (
        <p className="rounded-control border border-edge-strong bg-page px-4 py-3 text-[13px] text-ink-muted">
          This product is archived. Templates stay visible for reference, but new
          content generation and Studio are disabled.
        </p>
      ) : (
        <p className="text-[13px] text-ink-muted">
          Pick a format, then generate copy inside locked, on-brand artwork. Only
          the text fields change &mdash; layout and imagery stay compliant by
          construction.
          {!canGenerate &&
            " Generation is unavailable until an active template is configured."}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {activePlatformTemplates.map((template) => (
          <TemplateCard
            key={template.assignmentId}
            template={template}
            canGenerate={canGenerate}
            sizeStatus={sizeStatusByTemplate[template.versionId] ?? {}}
          />
        ))}
      </div>
    </div>
  );
}
