import { PageHeader } from "@/components/page-header";
import { DashboardSummaryPanel, type AttentionItem } from "@/components/dashboard-summary-panel";
import { getDashboardSummary, type DashboardSummary } from "@/lib/dashboard-server";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getAttentionItem(summary: DashboardSummary): AttentionItem {
  const { counts } = summary;

  if (counts.inReview > 0) {
    return {
      tone: "warn",
      title: `${counts.inReview} ${counts.inReview === 1 ? "piece" : "pieces"} waiting for review`,
      body: "Review drafts submitted across every product before they can be exported.",
      actionHref: "/approvals",
      actionLabel: "Review now",
    };
  }
  return {
    tone: "positive",
    title: "You're all caught up",
    body: "Nothing needs your review right now.",
    actionHref: null,
    actionLabel: undefined,
  };
}

export default async function DashboardPage() {
  const summary = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? await getDashboardSummary()
    : {
        counts: { documents: 0, content: 0, inReview: 0 },
        attention: [],
        recentActivity: [],
      };

  const attention = getAttentionItem(summary);
  const { counts, recentActivity } = summary;

  const stats = [
    { label: "Documents", value: counts.documents, href: "/knowledge" },
    { label: "Content", value: counts.content, href: "/content" },
    { label: "In review", value: counts.inReview, href: "/approvals" },
  ];

  const activity = recentActivity.map((item) => ({
    id: item.id,
    title: item.title,
    meta: [item.productName, item.templateName, item.targetLanguage, formatDate(item.updatedAt ?? item.createdAt)]
      .filter(Boolean)
      .join(" · "),
    status: item.status,
    href: `/content/${item.id}`,
  }));

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-9 sm:px-10">
      <PageHeader title="Dashboard" description="Recent content and what's waiting on approval." />

      <DashboardSummaryPanel
        attention={attention}
        stats={stats}
        viewAllHref="/content"
        activity={activity}
        emptyMessage="Generated content will show up here as soon as the team creates something."
      />
    </div>
  );
}
