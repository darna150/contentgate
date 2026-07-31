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

/**
 * Shared by the header row and every data row so they cannot drift apart.
 *
 * Every track is minmax(0, …) rather than a bare fr. Each row is its own grid
 * container, and a bare fr track keeps an automatic min-content floor — so a
 * row holding a wide status pill ("Changes requested") sized its columns
 * differently from its neighbours and the table visibly failed to line up.
 * A zero minimum makes every row resolve to identical widths.
 */
const COLUMNS =
  "minmax(0,2.3fr) minmax(0,1.6fr) minmax(0,0.8fr) minmax(0,1.4fr) minmax(0,0.45fr) minmax(0,1fr) minmax(0,0.7fr)";

/** Campaign identity comes from the campaign field, never parsed out of a title. */
const UNGROUPED = "Unassigned campaign";

function campaignOf(row: FlattenedContentRow) {
  return row.campaignName?.trim() || UNGROUPED;
}

function formatOf(row: FlattenedContentRow) {
  return row.sizeKey ? sizeLabel(row.sizeKey) : "Custom size";
}

/**
 * Supporting detail under the title, or null when there is nothing to add.
 * Campaign, format, language and revision all have their own place now, so the
 * only thing left worth a second line is the audience the piece was written
 * for — which is often what separates two pieces built from one template.
 */
function secondaryLine(row: FlattenedContentRow) {
  return row.audience?.trim() || null;
}

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
  const returnTo = ["status", "language", "size"]
    .map((key) => {
      const value = ({ status, language, size } as Record<string, string | undefined>)[key];
      return value ? `${key}=${encodeURIComponent(value)}` : null;
    })
    .filter(Boolean)
    .join("&");
  const contentReturnTo = returnTo ? `/content?${returnTo}` : "/content";

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
  // Grouped on the campaign the row actually belongs to. Titles are content
  // identity and are never parsed for campaign membership.
  const campaigns = new Map<string, FlattenedContentRow[]>();
  for (const row of rows) {
    const key = campaignOf(row);
    const group = campaigns.get(key) ?? [];
    group.push(row);
    campaigns.set(key, group);
  }

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
          {/* Desktop: 7-column grid table. Rows are grouped under the campaign
              they belong to, and carry their own title, format and revision so
              a reviewer can tell two pieces apart and see exactly which
              revision an approval would apply to. */}
          <div className="hidden md:flex md:flex-col">
            <div
              className="grid gap-3 border-b border-edge px-3.5 pb-2"
              style={{ gridTemplateColumns: COLUMNS }}
            >
              <span className="text-label text-ink-faint">Title</span>
              <span className="text-label text-ink-faint">Format</span>
              <span className="text-label text-ink-faint">Language</span>
              <span className="text-label text-ink-faint">Status</span>
              <span className="text-label text-ink-faint">Rev</span>
              <span className="text-label text-ink-faint">Owner</span>
              <span className="text-label text-ink-faint">Updated</span>
            </div>
            {Array.from(campaigns.entries()).map(([campaign, campaignRows]) => (
              <div key={campaign} className="border-b border-edge last:border-b-0">
                <div className="flex flex-wrap items-baseline gap-x-2 bg-page/70 px-3.5 py-2">
                  <span className="text-[12px] font-bold text-ink">{campaign}</span>
                  <span className="text-[11.5px] text-ink-faint">
                    {campaignRows.length} {campaignRows.length === 1 ? "piece" : "pieces"}
                  </span>
                </div>
                {campaignRows.map((row) => (
              <Link
                key={row.id}
                href={studioContentUrl(row.id, row.sizeKey ?? undefined, contentReturnTo)}
                className="grid items-center gap-3 rounded-control px-3.5 py-3 transition-colors hover:bg-page"
                style={{ gridTemplateColumns: COLUMNS }}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[13.5px] font-semibold">{row.title}</span>
                  {secondaryLine(row) && (
                    <span className="truncate text-[11.5px] text-ink-faint">
                      {secondaryLine(row)}
                    </span>
                  )}
                </span>
                <span className="truncate text-[12.5px] text-ink-muted">{formatOf(row)}</span>
                <span className="truncate text-[12.5px] text-ink-muted">{row.targetLanguage}</span>
                <span>
                  <StatusPill status={row.status} />
                </span>
                <span className="truncate text-[12.5px] tabular-nums text-ink-muted">
                  <span className="sr-only">Revision </span>r{row.revisionNumber}
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
            ))}
          </div>

          {/* Mobile: stacked cards */}
          <div className="flex flex-col gap-1 md:hidden">
            {Array.from(campaigns.entries()).map(([campaign, campaignRows]) => (
              <div key={campaign} className="border-b border-edge py-1 last:border-b-0">
                <p className="px-3.5 pb-1 pt-2 text-[12px] font-bold text-ink">
                  {campaign}
                  <span className="ml-2 text-[11px] font-normal text-ink-faint">
                    {campaignRows.length} {campaignRows.length === 1 ? "piece" : "pieces"}
                  </span>
                </p>
                {campaignRows.map((row) => (
              <Link
                key={row.id}
                href={studioContentUrl(row.id, row.sizeKey ?? undefined, contentReturnTo)}
                className="flex flex-col gap-1.5 rounded-control px-3.5 py-3 transition-colors hover:bg-page"
              >
                <span className="truncate text-[13.5px] font-semibold">{row.title}</span>
                <span className="truncate text-[11.5px] text-ink-faint">
                  {[secondaryLine(row), formatOf(row), row.targetLanguage]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <StatusPill status={row.status} />
                  <span className="text-[11.5px] text-ink-faint">
                    <span className="sr-only">Revision </span>r{row.revisionNumber} ·{" "}
                    {row.creatorName ?? "—"} · {formatDate(row.updatedAt ?? row.createdAt)}
                  </span>
                </span>
              </Link>
                ))}
              </div>
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
