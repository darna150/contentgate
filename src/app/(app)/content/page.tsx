import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import {
  getContentPage,
  type FlattenedContentRow,
} from "@/lib/content-listing";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "in_review", label: "In review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cursor?: string }>;
}) {
  const { status, cursor } = await searchParams;
  const filter = FILTERS.some((f) => f.key === status) ? status! : "all";

  let rows: FlattenedContentRow[] = [];
  let nextCursor: string | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const page = await getContentPage({
      cursor,
      status: filter === "all" ? null : filter,
    });
    rows = page.rows;
    nextCursor = page.nextCursor;
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
      <div className="flex items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-serif text-[28px] font-semibold">Content</h1>
          <p className="text-[14.5px] text-ink-muted">
            Everything generated, from draft to approved. Only approved content
            can be exported.
          </p>
        </div>
        <div className="flex-1" />
        <Link
          href="/products"
          className="rounded-control bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Generate content
        </Link>
      </div>

      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/content" : `/content?status=${f.key}`}
            className={`rounded-full px-3 py-[5px] text-xs font-semibold transition-colors ${
              filter === f.key
                ? "bg-brand-dark text-white"
                : "border border-edge-strong text-ink-muted hover:border-brand"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-16 text-center">
          <p className="text-[15px] font-semibold">
            {filter === "all" ? "Nothing generated yet" : "Nothing here"}
          </p>
          <p className="max-w-md text-sm text-ink-muted">
            {filter === "all"
              ? "Pick a product to generate your first piece of content from its approved knowledge."
              : "No content matches this filter."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1 rounded-card border border-edge bg-surface p-3">
          {rows.map((row) => {
            const meta = [
              row.productName,
              row.templateName,
              row.targetLanguage,
              row.audience,
            ].filter(Boolean);
            return (
              <Link
                key={row.id}
                href={`/content/${row.id}`}
                className="flex items-center gap-3.5 rounded-control px-3.5 py-3 transition-colors hover:bg-page"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13.5px] font-semibold">
                    {row.title}
                  </span>
                  <span className="text-[11.5px] text-ink-faint">
                    {meta.join(" · ")}
                    {meta.length > 0 ? " · " : ""}
                    {new Date(row.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </span>
                <StatusPill status={row.status} />
              </Link>
            );
          })}
          {nextCursor && (
            <Link
              href={
                filter === "all"
                  ? `/content?cursor=${nextCursor}`
                  : `/content?status=${filter}&cursor=${nextCursor}`
              }
              className="rounded-control px-3.5 py-3 text-center text-[13px] font-semibold text-brand transition-colors hover:bg-page"
            >
              Load older content
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
