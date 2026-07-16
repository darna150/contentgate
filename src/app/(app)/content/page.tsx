import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FilterChips } from "@/components/filter-chips";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { sizeLabel } from "@/lib/creative";
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
        <FilterChips
          options={[
            { label: "All languages", value: "all" },
            ...LANGUAGES.map((l) => ({ label: l, value: l })),
          ]}
          activeValue={activeLanguage}
          getHref={(value) => buildHref({ language: value })}
        />
        {sizeOptions.length > 0 && (
          <FilterChips
            options={[
              { label: "All sizes", value: "all" },
              ...sizeOptions.map((key) => ({ label: sizeLabel(key), value: key })),
            ]}
            activeValue={activeSize}
            getHref={(value) => buildHref({ size: value })}
          />
        )}
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
                    {formatDate(row.createdAt)}
                  </span>
                </span>
                <StatusPill status={row.status} />
              </Link>
            );
          })}
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
