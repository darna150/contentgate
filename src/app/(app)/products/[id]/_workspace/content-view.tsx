import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { studioContentUrl } from "@/lib/creative";
import type { ProductWorkspace } from "@/lib/product-workspace-server";
import { SectionEmpty } from "./empty-state";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function readinessSummary(
  items: ProductWorkspace["content"]
) {
  const counts = {
    draft: items.filter((item) => item.status === "draft").length,
    inReview: items.filter((item) => item.status === "in_review").length,
    approved: items.filter((item) => item.status === "approved").length,
    changes: items.filter((item) => item.status === "rejected").length,
  };
  return [
    counts.draft ? `${counts.draft} draft` : null,
    counts.inReview ? `${counts.inReview} in review` : null,
    counts.changes ? `${counts.changes} changes requested` : null,
    counts.approved ? `${counts.approved} approved` : null,
  ].filter((value): value is string => Boolean(value));
}

export function ContentView({ workspace }: { workspace: ProductWorkspace }) {
  const { product, content, permissions } = workspace;
  const returnTo = `/products/${product.id}?view=content`;

  if (content.length === 0) {
    return (
      <SectionEmpty
        code="generate_first_content"
        actionHref={
          permissions.canGenerateContent
            ? `/products/${product.id}?view=templates`
            : null
        }
        actionLabel={permissions.canGenerateContent ? "Go to templates" : undefined}
      />
    );
  }

  const campaigns = new Map<string, typeof content>();
  for (const item of content) {
    const key = item.title || item.templateVariant || item.id;
    const items = campaigns.get(key) ?? [];
    items.push(item);
    campaigns.set(key, items);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-ink-muted">
          Every piece generated for this product, from draft to approved.
        </p>
        <Link href="/content" className="text-[13px] font-semibold text-brand hover:underline">
          Open in Content →
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {Array.from(campaigns.entries()).map(([campaign, items]) => {
          const meta = [
            `${items.length} ${items.length === 1 ? "format" : "formats"}`,
          ].filter(Boolean);
          const readiness = readinessSummary(items);
          return (
            <section key={campaign} className="rounded-card border border-edge bg-surface p-3">
              <div className="flex items-center justify-between gap-3 px-2 pb-2">
                <div className="min-w-0"><h2 className="truncate text-[14px] font-bold text-ink">{campaign}</h2><p className="text-[12px] text-ink-faint">{meta.join(" · ")}</p><p className="mt-0.5 text-[11px] text-ink-muted">{readiness.join(" · ") || "No formats yet"}</p></div>
                <Link href={studioContentUrl(items[0].id, undefined, returnTo)} className="shrink-0 text-[12px] font-semibold text-brand hover:underline">Open campaign →</Link>
              </div>
              {items.map((item) => <Link key={item.id} href={studioContentUrl(item.id, undefined, returnTo)} className="flex items-center gap-3.5 rounded-control px-2 py-2.5 transition-colors hover:bg-page"><span className="min-w-0 flex-1"><span className="text-[13px] font-semibold">{item.templateVariant ?? "Format"}</span><span className="ml-2 text-[12px] text-ink-faint">{item.targetLanguage} · {formatDate(item.updatedAt)}</span></span><StatusPill status={item.status} /></Link>)}
            </section>
          );
        })}
      </div>
    </div>
  );
}
