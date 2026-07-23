import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FilterChips } from "@/components/filter-chips";
import { ContentFilterSelects } from "./content-filter-selects";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { sizeLabel, studioContentUrl } from "@/lib/creative";
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

const LANGUAGES = ["English", "Filipino", "Spanish", "Portuguese", "Vietnamese", "Thai"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    language?: string;
    size?: string;
    cursor?: string;
  }>;
}) {
  const { status, language, size, cursor } = await searchParams;
  const filter = FILTERS.some((f) => f.key === status) ? status! : "all";
  const activeLanguage = language && LANGUAGES.includes(language) ? language : "all";
  const activeSize = size ?? "all";

  let rows: FlattenedContentRow[] = [];
  let nextCursor: string | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const page = await getContentPage({
      cursor,
      status: filter === "all" ? null : filter,
      targetLanguage: activeLanguage === "all" ? null : activeLanguage,
      variantKey: activeSize === "all" ? null : activeSize,
    });
    rows = page.rows;
    nextCursor = page.nextCursor;
  }

  // Size filter options are derived from the sizes visible on this page (no
  // fixed enum exists — variant keys are product/template specific). Keep the
  // active size in the option set even if the current page has zero matches
  // for it, so the chip stays clickable to reset.
  const sizeKeysOnPage = new Set(
    rows.map((r) => r.sizeKey).filter((v): v is string => Boolean(v))
  );
  if (activeSize !== "all") sizeKeysOnPage.add(activeSize);
  const sizeOptions = Array.from(sizeKeysOnPage);

  function buildHref(overrides: {
    status?: string;
    language?: string;
    size?: string;
    cursor?: string;
  }) {
    const nextStatus = overrides.status ?? filter;
    const nextLanguage = overrides.language ?? activeLanguage;
    const nextSize = overrides.size ?? activeSize;
    const params = new URLSearchParams();
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextLanguage !== "all") params.set("language", nextLanguage);
    if (nextSize !== "all") params.set("size", nextSize);
    if (overrides.cursor) params.set("cursor", overrides.cursor);
    const query = params.toString();
    return query ? `/content?${query}` : "/content";
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-9 sm:px-10">
      <PageHeader
        title="Content"
        description="Everything generated, from draft to approved. Only approved content can be exported."
        actions={
          <Button asChild>
            <Link href="/products">Generate content</Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-2.5">
        <FilterChips
          options={FILTERS.map((f) => ({ label: f.label, value: f.key }))}
          activeValue={filter}
          getHref={(value) => buildHref({ status: value })}
        />
        <ContentFilterSelects
          activeLanguage={activeLanguage}
          activeSize={activeSize}
          languages={LANGUAGES}
          sizeOptions={sizeOptions.map((key) => ({ value: key, label: sizeLabel(key) }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={filter === "all" ? "Nothing generated yet" : "Nothing here"}
          description={
            filter === "all"
              ? "Pick a product to generate your first piece of content from its approved knowledge."
              : "No content matches this filter."
          }
        />
      ) : (
        <Card className="gap-1 p-3">
          {/* Desktop: 6-column grid table */}
          <div className="hidden md:flex md:flex-col">
            <div
              className="grid gap-3 border-b border-edge px-3.5 pb-2"
              style={{ gridTemplateColumns: "2.2fr 0.8fr 0.7fr 1.3fr 1fr 0.8fr" }}
            >
              <span className="text-label text-ink-faint">Title</span>
              <span className="text-label text-ink-faint">Language</span>
              <span className="text-label text-ink-faint">Size</span>
              <span className="text-label text-ink-faint">Status</span>
              <span className="text-label text-ink-faint">Owner</span>
              <span className="text-label text-ink-faint">Updated</span>
            </div>
            {rows.map((row) => (
              <Link
                key={row.id}
                href={studioContentUrl(row.id, row.sizeKey ?? undefined)}
                className="grid items-center gap-3 rounded-control px-3.5 py-3 transition-colors hover:bg-page"
                style={{ gridTemplateColumns: "2.2fr 0.8fr 0.7fr 1.3fr 1fr 0.8fr" }}
              >
                <span className="min-w-0 truncate text-[13.5px] font-semibold">{row.title}</span>
                <span className="truncate text-[12.5px] text-ink-muted">{row.targetLanguage}</span>
                <span className="truncate text-[12.5px] text-ink-muted">
                  {row.sizeKey ? sizeLabel(row.sizeKey) : "—"}
                </span>
                <span>
                  <StatusPill status={row.status} />
                </span>
                <span className="truncate text-[12.5px] text-ink-muted">
                  {row.creatorName ?? "—"}
                </span>
                <span className="truncate text-[12.5px] text-ink-faint">
                  {formatDate(row.updatedAt ?? row.createdAt)}
                </span>
              </Link>
            ))}
          </div>

          {/* Mobile: stacked cards */}
          <div className="flex flex-col gap-1 md:hidden">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={studioContentUrl(row.id, row.sizeKey ?? undefined)}
                className="flex flex-col gap-1.5 rounded-control px-3.5 py-3 transition-colors hover:bg-page"
              >
                <span className="truncate text-[13.5px] font-semibold">{row.title}</span>
                <span className="truncate text-[11.5px] text-ink-faint">
                  {[row.productName, row.targetLanguage, row.sizeKey ? sizeLabel(row.sizeKey) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="flex items-center gap-2">
                  <StatusPill status={row.status} />
                  <span className="text-[11.5px] text-ink-faint">
                    {row.creatorName ?? "—"} · {formatDate(row.updatedAt ?? row.createdAt)}
                  </span>
                </span>
              </Link>
            ))}
          </div>

          {nextCursor && (
            <Button asChild variant="ghost" className="mt-1 justify-center">
              <Link href={buildHref({ cursor: nextCursor })}>Load older content</Link>
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
