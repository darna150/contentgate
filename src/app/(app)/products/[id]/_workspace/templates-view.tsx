import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PreviewImage } from "@/components/preview-image";
import { SizeChip, type SizeChipStatus } from "@/components/size-chip";
import { studioContentUrl, studioNewUrl } from "@/lib/creative";
import type { ProductWorkspace, ProductWorkspacePlatformTemplate } from "@/lib/product-workspace-server";
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

function channelForFormat(label: string) {
  const name = label.toLowerCase();
  if (name.startsWith("instagram")) return "Instagram";
  if (name.startsWith("facebook")) return "Facebook / Meta";
  if (name.startsWith("linkedin")) return "LinkedIn";
  if (name.includes("banner") || name.includes("ad") || name.includes("card")) return "Display";
  if (name.includes("print") || name.includes("poster")) return "Print";
  return "Other";
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
  productId,
  contentBySize,
}: {
  template: ProductWorkspacePlatformTemplate;
  canGenerate: boolean;
  sizeStatus: Record<string, SizeChipStatus>;
  productId: string;
  contentBySize: Partial<Record<string, ProductWorkspace["content"][number]>>;
}) {
  const previewPath = template.referenceAssetBySize[template.defaultVariantKey] ?? "";
  const dims = template.variantMetaBySize[template.defaultVariantKey];
  const totalDrafts = Object.values(sizeStatus).filter((status) => status !== "empty").length;
  const formatsByChannel = new Map<string, string[]>();
  for (const size of template.supportedSizes) {
    const label = template.variantMetaBySize[size]?.label ?? size;
    const channel = channelForFormat(label);
    formatsByChannel.set(channel, [...(formatsByChannel.get(channel) ?? []), size]);
  }

  return (
    <section className="overflow-hidden rounded-card border border-edge bg-surface transition-colors hover:border-brand/40">
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(180px,240px)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          {previewPath ? (
            <div
              className="overflow-hidden rounded-[10px] border border-edge bg-brand-tint"
              style={{ aspectRatio: dims ? `${dims.width} / ${dims.height}` : "1 / 1" }}
            >
              <PreviewImage src={imageSrc(previewPath)} alt={`${template.familyName} original design`} />
            </div>
          ) : null}
          <p className="text-[12px] leading-5 text-ink-muted">
            Locked layout and approved visual system. Each format starts independently.
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-edge pb-4">
            <div>
              <p className="text-label text-ink-faint">Campaign package</p>
              <h2 className="mt-1 text-[18px] font-bold tracking-[-0.02em] text-ink">{template.familyName}</h2>
              <p className="mt-1 text-[13px] text-ink-muted">
                {template.supportedSizes.length} formats · {totalDrafts} started
              </p>
            </div>
            <Badge variant="approve" className="shrink-0">Locked design</Badge>
          </div>

          <div className="grid gap-x-6 sm:grid-cols-2">
            {Array.from(formatsByChannel.entries()).map(([channel, sizes]) => {
              const started = sizes.filter((size) => (sizeStatus[size] ?? "empty") !== "empty").length;
              const approved = sizes.filter((size) => sizeStatus[size] === "approved").length;
              return (
              <details key={channel} className="group border-t border-edge py-1.5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[8px] px-2 py-2.5 transition-colors hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  <div>
                    <h3 className="text-label text-ink-faint">{channel}</h3>
                    <p className="mt-1 text-[12px] text-ink-muted">
                      {sizes.length} formats · {started ? `${started} started` : "None started"}
                      {approved ? ` · ${approved} approved` : ""}
                    </p>
                  </div>
                  <span className="flex items-center gap-2 text-[12px] font-semibold text-brand">
                    <span className="group-open:hidden">Choose format</span>
                    <span className="hidden group-open:inline">Hide formats</span>
                    <span className="text-[16px] leading-none transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </span>
                </summary>
                <ul className="mt-1 divide-y divide-edge/70">
                  {sizes.map((size) => {
                    const meta = template.variantMetaBySize[size];
                    const item = contentBySize[size];
                    const status = sizeStatus[size] ?? "empty";
                    const href = item
                      ? studioContentUrl(item.id, size, `/products/${productId}?view=templates`)
                      : studioNewUrl({ productId, assignmentId: template.assignmentId, size });
                    const action = item
                      ? status === "approved"
                        ? "View approved"
                        : status === "in_review"
                          ? "View review"
                          : "Open draft"
                      : "Generate draft";
                    return (
                      <li key={size} className="flex flex-wrap items-center justify-between gap-2 py-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-ink">{meta?.label ?? size}</p>
                          <p className="mt-0.5 text-[11px] text-ink-faint">
                            {meta ? `${meta.width} × ${meta.height}` : "Dimensions unavailable"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <SizeChip label={status === "empty" ? "Needs draft" : status.replace("_", " ")} status={status} />
                          {canGenerate && (
                            <Button asChild variant={item ? "outline" : "default"} size="sm">
                              <Link href={href}>{action}</Link>
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function TemplatesView({ workspace }: { workspace: ProductWorkspace }) {
  const { product, activePlatformTemplates, permissions, sections, content } = workspace;
  const canGenerate = permissions.canGenerateContent;
  const isArchived = product.status === "archived";
  const sizeStatusByTemplate = buildSizeStatusMap(content);
  const contentByTemplateAndSize = new Map<string, Partial<Record<string, ProductWorkspace["content"][number]>>>();
  for (const item of content) {
    if (!item.templateVersionId || !item.sizeKey) continue;
    const bySize = contentByTemplateAndSize.get(item.templateVersionId) ?? {};
    if (!bySize[item.sizeKey]) bySize[item.sizeKey] = item;
    contentByTemplateAndSize.set(item.templateVersionId, bySize);
  }

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
      <div className="max-w-2xl">
        <p className="text-label text-ink-faint">Campaigns</p>
        <h2 className="mt-1 text-[24px] font-bold tracking-[-0.03em] text-ink">Make every format feel like one campaign.</h2>
      </div>
      {isArchived ? (
        <p className="rounded-control border border-edge-strong bg-page px-4 py-3 text-[13px] text-ink-muted">
          This product is archived. Templates stay visible for reference, but new
          content generation and Studio are disabled.
        </p>
      ) : (
        <p className="max-w-2xl text-[13px] leading-5 text-ink-muted">
          Choose a format to start its own draft. You can explicitly copy from another
          format in Studio; layout, imagery, and approval remain specific to this format.
          {!canGenerate &&
            " Generation is unavailable until an active template is configured."}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {activePlatformTemplates.map((template) => (
          <TemplateCard
            key={template.assignmentId}
            template={template}
            canGenerate={canGenerate}
            sizeStatus={sizeStatusByTemplate[template.versionId] ?? {}}
            productId={product.id}
            contentBySize={contentByTemplateAndSize.get(template.versionId) ?? {}}
          />
        ))}
      </div>
    </div>
  );
}
