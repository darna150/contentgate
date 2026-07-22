import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FilterChips } from "@/components/filter-chips";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getApprovalPage } from "@/lib/content-listing";
import { studioContentUrl } from "@/lib/creative";
import { getProductWorkspace } from "@/lib/product-workspace-server";

const LANGUAGES = ["English", "Filipino", "Spanish", "Portuguese", "Vietnamese", "Thai"];

const LANG_CODE: Record<string, string> = {
  English: "EN",
  Filipino: "FIL",
  Spanish: "ES",
  Portuguese: "PT",
  Vietnamese: "VI",
  Thai: "TH",
};

type QueueRow = {
  id: string;
  title: string;
  target_language: string;
  audience: string | null;
  created_at: string;
  templateName: string | null;
  creatorName: string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type Urgency = "fresh" | "normal" | "urgent";

function approvalUrgency(createdAtIso: string): { tone: Urgency; waitingLabel: string } {
  const hours = (Date.now() - new Date(createdAtIso).getTime()) / (60 * 60 * 1000);
  const days = hours / 24;
  const waitingLabel = days >= 1 ? `waiting ${Math.floor(days)}d` : `waiting ${Math.max(1, Math.round(hours))}h`;
  if (days > 2) return { tone: "urgent", waitingLabel };
  if (hours < 6) return { tone: "fresh", waitingLabel };
  return { tone: "normal", waitingLabel };
}

const URGENCY_BORDER: Record<Urgency, string> = {
  fresh: "border-l-brand",
  normal: "border-l-brand",
  urgent: "border-l-reject",
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; language?: string; cursor?: string }>;
}) {
  const { product: productId, language, cursor } = await searchParams;
  const activeLanguage = language && LANGUAGES.includes(language) ? language : "all";

  let rows: QueueRow[] = [];
  let nextCursor: string | null = null;
  let productName: string | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    if (productId) {
      const workspace = await getProductWorkspace(productId, {
        view: "approvals",
        approvalCursor: cursor,
      });
      if (!workspace) notFound();
      productName = workspace.product.name;
      rows = workspace.approvals.map((item) => ({
        id: item.id,
        title: item.title,
        target_language: item.targetLanguage,
        audience: item.audience,
        created_at: item.createdAt,
        templateName: item.templateVariant,
        creatorName: item.creatorName,
      }));
      nextCursor = workspace.approvalsNextCursor;
    } else {
      const page = await getApprovalPage({
        cursor,
        targetLanguage: activeLanguage === "all" ? null : activeLanguage,
      });
      rows = page.rows.map((row) => {
        return {
          id: row.id,
          title: row.title,
          target_language: row.targetLanguage,
          audience: row.audience,
          created_at: row.createdAt,
          templateName: row.templateName,
          creatorName: row.creatorName,
        };
      });
      nextCursor = page.nextCursor;
    }
  }

  function buildHref(overrides: { language?: string; cursor?: string }) {
    const nextLanguage = overrides.language ?? activeLanguage;
    const params = new URLSearchParams();
    if (productId) params.set("product", productId);
    if (!productId && nextLanguage !== "all") params.set("language", nextLanguage);
    if (overrides.cursor) params.set("cursor", overrides.cursor);
    const query = params.toString();
    return query ? `/approvals?${query}` : "/approvals";
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-9 sm:px-10">
      <div className="flex flex-col gap-1.5">
        {productId && productName && (
          <Link
            href={`/products/${productId}`}
            className="text-[13px] font-semibold text-brand hover:underline"
          >
            ← {productName}
          </Link>
        )}
        <PageHeader
          eyebrow="Approvals"
          title={productName ? `In review — ${productName}` : "In review, workspace-wide"}
        />
      </div>

      {!productId && (
        <FilterChips
          options={[
            { label: "All languages", value: "all" },
            ...LANGUAGES.map((l) => ({ label: LANG_CODE[l] ?? l, value: l })),
          ]}
          activeValue={activeLanguage}
          getHref={(value) => buildHref({ language: value })}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="The queue is clear"
          description="When someone submits content for review, it lands here."
        />
      ) : (
        <Card className="gap-1 p-3">
          {rows.map((row) => {
            const urgency = approvalUrgency(row.created_at);
            return (
              <Link
                key={row.id}
                href={studioContentUrl(row.id)}
                className={`flex items-center gap-3.5 rounded-control border-l-4 px-3.5 py-3 transition-colors hover:bg-page ${URGENCY_BORDER[urgency.tone]}`}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13.5px] font-semibold">
                    {row.title}
                  </span>
                  <span className="text-[11.5px] text-ink-faint">
                    {row.templateName ?? "Custom"} · {row.target_language}
                    {row.audience ? ` · ${row.audience}` : ""} · submitted by{" "}
                    {row.creatorName ?? "a teammate"} · {formatDate(row.created_at)}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-0.5">
                  <span
                    className={`text-[11.5px] font-semibold ${urgency.tone === "urgent" ? "text-reject" : "text-brand"}`}
                  >
                    {urgency.waitingLabel}
                  </span>
                  {urgency.tone === "urgent" && (
                    <span className="rounded-[5px] bg-reject-tint px-[6px] py-0.5 text-[9.5px] font-bold uppercase tracking-[0.05em] text-reject">
                      Blocked on you
                    </span>
                  )}
                </span>
                <span className="rounded-[7px] bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white">
                  Review
                </span>
              </Link>
            );
          })}
          {nextCursor && (
            <Button asChild variant="ghost" className="mt-1 justify-center">
              <Link href={buildHref({ cursor: nextCursor })}>Load more approvals</Link>
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
