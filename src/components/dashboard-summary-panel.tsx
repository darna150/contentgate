import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/status-pill";

export type AttentionTone = "warn" | "info" | "positive";

export type AttentionItem = {
  tone: AttentionTone;
  title: string;
  body: string;
  actionHref?: string | null;
  actionLabel?: string;
};

export type SummaryStat = {
  label: string;
  value: number;
  caption?: string;
  href?: string;
};

export type SummaryActivityItem = {
  id: string;
  title: string;
  meta: string;
  status: string;
  href: string;
};

const TONE_STYLES: Record<AttentionTone, string> = {
  warn: "border-warn-border bg-warn-tint",
  info: "border-brand/25 bg-brand-tint/40",
  positive: "border-approve-tint bg-approve-tint/40",
};

/**
 * Shared banner + stat-tile + activity-list panel, used at workspace scope
 * (Dashboard) and product scope (Product Overview tab).
 */
export function DashboardSummaryPanel({
  attention,
  stats,
  activityTitle,
  viewAllHref,
  viewAllLabel = "View all content →",
  activity,
  emptyMessage,
}: {
  attention: AttentionItem;
  stats: SummaryStat[];
  activityTitle?: string;
  viewAllHref: string;
  viewAllLabel?: string;
  activity: SummaryActivityItem[];
  emptyMessage: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className={`flex flex-col gap-3 rounded-r-card border-l-4 border-y border-r p-5 sm:flex-row sm:items-center sm:justify-between ${TONE_STYLES[attention.tone]}`}>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-ink">{attention.title}</p>
          <p className="text-[13px] leading-relaxed text-ink-muted">{attention.body}</p>
        </div>
        {attention.actionHref && attention.actionLabel && (
          <Link href={attention.actionHref} className="shrink-0 text-[13px] font-bold text-brand hover:underline">
            {attention.actionLabel} →
          </Link>
        )}
      </div>

      <div
        className={
          stats.length > 3
            ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
            : "grid grid-cols-1 gap-3 sm:grid-cols-3"
        }
      >
        {stats.map((stat) =>
          stat.href ? (
            <Link
              key={stat.label}
              href={stat.href}
              className="flex flex-col gap-1 rounded-card border border-edge bg-surface p-4 transition-colors hover:border-brand"
            >
              <span className="text-label text-ink-faint">{stat.label}</span>
              <span className={`text-[34px] font-bold leading-none ${stat.label === "In review" ? "text-brand" : "text-ink"}`}>
                {stat.value}
              </span>
              {stat.caption && <span className="text-[12px] text-ink-faint">{stat.caption}</span>}
            </Link>
          ) : (
            <div
              key={stat.label}
              className="flex flex-col gap-1 rounded-card border border-edge bg-surface p-4"
            >
              <span className="text-label text-ink-faint">{stat.label}</span>
              <span className={`text-[34px] font-bold leading-none ${stat.label === "In review" ? "text-brand" : "text-ink"}`}>
                {stat.value}
              </span>
              {stat.caption && <span className="text-[12px] text-ink-faint">{stat.caption}</span>}
            </div>
          )
        )}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>{activityTitle ?? "Recent activity"}</CardTitle>
          <Link href={viewAllHref} className="text-[13px] font-semibold text-brand hover:underline">
            {viewAllLabel}
          </Link>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-[13px] text-ink-muted">{emptyMessage}</p>
          ) : (
            <div className="flex flex-col gap-1">
              {activity.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-3.5 rounded-control px-3.5 py-3 transition-colors hover:bg-page"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13.5px] font-semibold text-ink">{item.title}</span>
                    <span className="truncate text-[11.5px] text-ink-faint">{item.meta}</span>
                  </span>
                  <StatusPill status={item.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
