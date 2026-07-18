import { DashboardSummaryPanel, type AttentionItem } from "@/components/dashboard-summary-panel";
import type { ProductWorkspace } from "@/lib/product-workspace-server";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getAttentionItem(workspace: ProductWorkspace): AttentionItem {
  const { product, counts, sections, permissions } = workspace;

  if (product.status === "archived") {
    return {
      tone: "info",
      title: "This product is archived",
      body: "Templates and content stay visible for reference, but new generation and Studio are disabled.",
      actionHref: null,
      actionLabel: undefined,
    };
  }
  if (counts.inReview > 0 && permissions.canReviewContent) {
    return {
      tone: "warn",
      title: `${counts.inReview} ${counts.inReview === 1 ? "piece" : "pieces"} waiting for review`,
      body: "Review drafts submitted by the team before they can be exported.",
      actionHref: `/products/${product.id}?view=approvals`,
      actionLabel: "Review now",
    };
  }
  if (sections.templates.isEmpty) {
    return {
      tone: "info",
      title: "No active template yet",
      body: "Configure a locked template before content can be generated for this product.",
      actionHref: sections.templates.actionHref,
      actionLabel: sections.templates.canAct ? "Configure a template" : undefined,
    };
  }
  if (sections.knowledge.isEmpty) {
    return {
      tone: "info",
      title: "No approved knowledge yet",
      body: "Add a source document or an approved claim so generated content stays grounded.",
      actionHref: sections.knowledge.actionHref,
      actionLabel: sections.knowledge.canAct ? "Add knowledge" : undefined,
    };
  }
  if (sections.assets.isEmpty) {
    return {
      tone: "info",
      title: "No assets yet",
      body: "Upload the first logo, packshot, background, or supporting image for this product.",
      actionHref: sections.assets.actionHref,
      actionLabel: sections.assets.canAct ? "Upload an asset" : undefined,
    };
  }
  if (counts.content === 0 && permissions.canGenerateContent) {
    return {
      tone: "info",
      title: "Ready to generate your first piece",
      body: "Pick a template and size in the Templates tab to create the first draft.",
      actionHref: `/products/${product.id}?view=templates`,
      actionLabel: "Go to templates",
    };
  }
  return {
    tone: "positive",
    title: "You're all caught up",
    body: "Nothing needs your attention right now.",
    actionHref: permissions.canGenerateContent ? `/products/${product.id}?view=templates` : null,
    actionLabel: permissions.canGenerateContent ? "Generate more content" : undefined,
  };
}

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

  const activity = recent.map((item) => ({
    id: item.id,
    title: item.title,
    meta: [item.templateVariant, item.targetLanguage, formatDate(item.updatedAt)].filter(Boolean).join(" · "),
    status: item.status,
    href: `/content/${item.id}`,
  }));

  return (
    <DashboardSummaryPanel
      attention={attention}
      stats={stats}
      viewAllHref={`/products/${workspace.product.id}?view=content`}
      activity={activity}
      emptyMessage="Generated content will show up here as soon as the team creates something."
    />
  );
}
