import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/status-pill";
import { getDashboardSummary, type DashboardSummary } from "@/lib/dashboard-server";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const TONE_STYLES = {
  warn: "border-warn-border bg-warn-tint",
  positive: "border-approve-tint bg-approve-tint/40",
} as const;

function getAttentionItem(summary: DashboardSummary) {
  const { counts } = summary;

  if (counts.inReview > 0) {
    return {
      tone: "warn" as const,
      title: `${counts.inReview} ${counts.inReview === 1 ? "piece" : "pieces"} waiting for review`,
      body: "Review drafts submitted across every product before they can be exported.",
      actionHref: "/approvals",
      actionLabel: "Review now",
    };
  }
  return {
    tone: "positive" as const,
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

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-9 sm:px-10">
      <PageHeader
        title="Dashboard"
        description="Recent content and what's waiting on approval."
      />

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="flex flex-col gap-1 rounded-card border border-edge bg-surface p-4 transition-colors hover:border-brand"
          >
            <span className="text-[22px] font-bold text-ink">{stat.value}</span>
            <span className="text-[11.5px] font-semibold text-ink-faint">{stat.label}</span>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Recent activity</CardTitle>
          <Link
            href="/content"
            className="text-[13px] font-semibold text-brand hover:underline"
          >
            View all content →
          </Link>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              Generated content will show up here as soon as the team creates something.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {recentActivity.map((item) => {
                const meta = [item.productName, item.templateName, item.targetLanguage, formatDate(item.updatedAt ?? item.createdAt)]
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
