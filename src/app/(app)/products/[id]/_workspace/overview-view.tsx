import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/status-pill";
import type { ProductWorkspace } from "@/lib/product-workspace-server";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getAttentionItem(workspace: ProductWorkspace) {
  const { product, counts, sections, permissions } = workspace;

  if (product.status === "archived") {
    return {
      tone: "info" as const,
      title: "This product is archived",
      body: "Templates and content stay visible for reference, but new generation and Studio are disabled.",
      actionHref: null,
      actionLabel: undefined,
    };
  }
  if (counts.inReview > 0 && permissions.canReviewContent) {
    return {
      tone: "warn" as const,
      title: `${counts.inReview} ${counts.inReview === 1 ? "piece" : "pieces"} waiting for review`,
      body: "Review drafts submitted by the team before they can be exported.",
      actionHref: `/products/${product.id}?view=approvals`,
      actionLabel: "Review now",
    };
  }
  if (sections.templates.isEmpty) {
    return {
      tone: "info" as const,
      title: "No active template yet",
      body: "Configure a locked template before content can be generated for this product.",
      actionHref: sections.templates.actionHref,
      actionLabel: sections.templates.canAct ? "Configure a template" : undefined,
    };
  }
  if (sections.knowledge.isEmpty) {
    return {
      tone: "info" as const,
      title: "No approved knowledge yet",
      body: "Add a source document or an approved claim so generated content stays grounded.",
      actionHref: sections.knowledge.actionHref,
      actionLabel: sections.knowledge.canAct ? "Add knowledge" : undefined,
    };
  }
  if (sections.assets.isEmpty) {
    return {
      tone: "info" as const,
      title: "No assets yet",
      body: "Upload the first logo, packshot, background, or supporting image for this product.",
      actionHref: sections.assets.actionHref,
      actionLabel: sections.assets.canAct ? "Upload an asset" : undefined,
    };
  }
  if (counts.content === 0 && permissions.canGenerateContent) {
    return {
      tone: "info" as const,
      title: "Ready to generate your first piece",
      body: "Pick a template and size in the Templates tab to create the first draft.",
      actionHref: `/products/${product.id}?view=templates`,
      actionLabel: "Go to templates",
    };
  }
  return {
    tone: "positive" as const,
    title: "You're all caught up",
    body: "Nothing needs your attention right now.",
    actionHref: permissions.canGenerateContent
      ? `/products/${product.id}?view=templates`
      : null,
    actionLabel: permissions.canGenerateContent ? "Generate more content" : undefined,
  };
}

const TONE_STYLES = {
  warn: "border-warn-border bg-warn-tint",
  info: "border-brand/25 bg-brand-tint/40",
  positive: "border-approve-tint bg-approve-tint/40",
} as const;

export function OverviewView({ workspace }: { workspace: ProductWorkspace }) {
  const { counts, content } = workspace;
  const attention = getAttentionItem(workspace);
  const recent = content.slice(0, 5);

  const stats = [
    { label: "Active templates", value: counts.activeTemplates },
    { label: "Content", value: counts.content },
    { label: "In review", value: counts.inReview },
    { label: "Approved knowledge", value: counts.approvedSources + counts.approvedClaims },
    { label: "Assets", value: counts.assets },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className={`flex flex-col gap-2 rounded-card border p-5 ${TONE_STYLES[attention.tone]}`}>
        <p className="text-[15px] font-bold text-ink">{attention.title}</p>
        <p className="text-[13px] leading-relaxed text-ink-muted">{attention.body}</p>
        {attention.actionHref && attention.actionLabel && (
          <div>
            <Button asChild size="sm">
              <Link href={attention.actionHref}>{attention.actionLabel}</Link>
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1 rounded-card border border-edge bg-surface p-4"
          >
            <span className="text-[22px] font-bold text-ink">{stat.value}</span>
            <span className="text-[11.5px] font-semibold text-ink-faint">{stat.label}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Recent activity</CardTitle>
          <Link
            href={`/products/${workspace.product.id}?view=content`}
            className="text-[13px] font-semibold text-brand hover:underline"
          >
            View all content →
          </Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              Generated content will show up here as soon as the team creates something.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {recent.map((item) => {
                const meta = [item.templateVariant, item.targetLanguage, formatDate(item.updatedAt)]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <Link
                    key={item.id}
                    href={`/content/${item.id}`}
                    className="flex items-center gap-3.5 rounded-control px-3.5 py-3 transition-colors hover:bg-page"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13.5px] font-semibold text-ink">
                        {item.title}
                      </span>
                      <span className="truncate text-[11.5px] text-ink-faint">{meta}</span>
                    </span>
                    <StatusPill status={item.status} />
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
