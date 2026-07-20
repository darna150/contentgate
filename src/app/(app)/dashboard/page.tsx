import { DashboardSummaryPanel, type AttentionItem } from "@/components/dashboard-summary-panel";
import { studioContentUrl } from "@/lib/creative";
import { getDashboardSummary, type DashboardSummary } from "@/lib/dashboard-server";
import { createClient } from "@/lib/supabase/server";

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

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  let displayName = "Preview";
  let summary: DashboardSummary = {
    counts: { documents: 0, content: 0, inReview: 0 },
    attention: [],
    recentActivity: [],
  };

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const [{ data: userResult }, dashboardSummary] = await Promise.all([
      supabase.auth.getUser(),
      getDashboardSummary(),
    ]);
    summary = dashboardSummary;

    const user = userResult.user;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      displayName = profile?.full_name?.split(/\s+/)[0] || user.email?.split("@")[0] || "there";
    }
  }

  const attention = getAttentionItem(summary);
  const { counts, recentActivity } = summary;

  const stats = [
    { label: "Documents", value: counts.documents, caption: "Approved source files", href: "/knowledge" },
    { label: "Content", value: counts.content, caption: "Generated pieces", href: "/content" },
    { label: "In review", value: counts.inReview, caption: "Waiting for sign-off", href: "/approvals" },
  ];

  const activity = recentActivity.map((item) => ({
    id: item.id,
    title: item.title,
    meta: [item.productName, item.templateName, item.targetLanguage, formatDate(item.updatedAt ?? item.createdAt)]
      .filter(Boolean)
      .join(" · "),
    status: item.status,
    href: studioContentUrl(item.id, item.sizeKey ?? undefined),
  }));

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-9 sm:px-10 lg:px-12 lg:py-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[30px] font-bold leading-tight tracking-[-0.03em] text-ink">
          {greetingForNow()}, {displayName}.
        </h1>
        <p className="text-[14px] text-ink-muted">
          Recent content and what&apos;s waiting on approval.
        </p>
      </div>

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
