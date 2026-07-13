import Link from "next/link";
import type { ProductWorkspace } from "@/lib/product-workspace-server";
import { SectionEmpty } from "./empty-state";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ApprovalsView({ workspace }: { workspace: ProductWorkspace }) {
  const { approvals, permissions, sections } = workspace;
  const canReview = permissions.canReviewContent;

  if (approvals.length === 0) {
    return <SectionEmpty code="queue_clear" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-ink-muted">
          {canReview
            ? "Content waiting for your review. Only approved content can be exported."
            : "Content from this product currently in review."}
        </p>
        {canReview && sections.approvals.actionHref && (
          <Link
            href={sections.approvals.actionHref}
            className="text-[13px] font-semibold text-brand hover:underline"
          >
            Open Approval Queue →
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-1 rounded-card border border-edge bg-surface p-3">
        {approvals.map((item) => {
          const meta = [
            item.templateVariant ?? "Custom",
            item.targetLanguage,
            item.audience,
            `by ${item.creatorName ?? "a teammate"}`,
            formatDate(item.createdAt),
          ].filter(Boolean);
          return (
            <Link
              key={item.id}
              href={`/content/${item.id}`}
              className="flex items-center gap-3.5 rounded-control px-3.5 py-3 transition-colors hover:bg-page"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13.5px] font-semibold">
                  {item.title}
                </span>
                <span className="truncate text-[11.5px] text-ink-faint">
                  {meta.join(" · ")}
                </span>
              </span>
              <span className="inline-flex flex-shrink-0 rounded-full bg-[#FBF3E2] px-[9px] py-0.5 text-[11.5px] font-semibold text-warn">
                In review
              </span>
              <span className="flex-shrink-0 text-[13px] font-semibold text-brand">
                {canReview ? "Review →" : "View →"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
