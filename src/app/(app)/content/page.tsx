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

/** Shared by the header row and every data row so they cannot drift apart. */
const COLUMNS = "2.4fr 0.9fr 1.3fr 1fr 0.8fr";

/**
 * Supporting detail for a row, or null when there is nothing worth a second
 * line.
 *
 * Template names are composed of dot-separated parts that in practice restate
 * the campaign and the format — e.g. "Nimbus Air Campaign · Instagram post
 * (square)" under a "Nimbus 1 · Nimbus Air Campaign" heading, next to an
 * "Instagram Post Square" label. Printing that whole string made every row in a
 * campaign look identical. Parts that are already on screen are dropped and
 * only genuinely new ones survive, so a template that really does distinguish
 * two rows still shows.
 *
 * Audience is the attribute that most often separates two pieces built from the
 * same template, so it leads when it is set.
 */
/** The row's identity within its campaign group. */
function formatOf(row: FlattenedContentRow) {
  return row.sizeKey ? sizeLabel(row.sizeKey) : "Custom size";
}

function secondaryLine(row: FlattenedContentRow, campaign: string, format: string) {
  if (row.audience?.trim()) return row.audience.trim();

  // Compared without case or punctuation so "Instagram post (square)" matches
  // the "Instagram Post Square" label rendered above it.
  const key = (part: string) => part.toLowerCase().replace(/[^a-z0-9]/g, "");

  const shown = new Set(
    [...campaign.split("·"), format].map(key).filter(Boolean)
  );
  const remaining = (row.templateName ?? "")
    .split("·")
    .map((part) => part.trim())
    .filter((part) => part && !shown.has(key(part)));

  return remaining.length ? remaining.join(" · ") : null;
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
  const campaigns = new Map<string, FlattenedContentRow[]>();
  for (const row of rows) {
    const group = campaigns.get(row.title) ?? [];
    group.push(row);
    campaigns.set(row.title, group);
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
          {/* Desktop: 5-column grid table.
              Rows sit under a campaign heading, so repeating the campaign name
              on every row told a reviewer nothing and pushed the one attribute
              that does distinguish two rows — the format — into a column too
              narrow to read. The format leads the row instead, and the former
              separate Size column is folded into it. */}
          <div className="hidden md:flex md:flex-col">
            <div
              className="grid gap-3 border-b border-edge px-3.5 pb-2"
              style={{ gridTemplateColumns: COLUMNS }}
            >
              <span className="text-label text-ink-faint">Format</span>
              <span className="text-label text-ink-faint">Language</span>
              <span className="text-label text-ink-faint">Status</span>
              <span className="text-label text-ink-faint">Owner</span>
              <span className="text-label text-ink-faint">Updated</span>
            </div>
            {Array.from(campaigns.entries()).map(([campaign, campaignRows]) => (
              <div key={campaign} className="border-b border-edge last:border-b-0">
                <div className="flex flex-wrap items-baseline gap-x-2 bg-page/70 px-3.5 py-2">
                  <span className="text-[12px] font-bold text-ink">{campaign}</span>
                  <span className="text-[11.5px] text-ink-faint">
                    {campaignRows.length} {campaignRows.length === 1 ? "format" : "formats"}
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
                  <span className="truncate text-[13.5px] font-semibold">
                    {formatOf(row)}
                  </span>
                  {secondaryLine(row, campaign, formatOf(row)) && (
                    <span className="truncate text-[11.5px] text-ink-faint">
                      {secondaryLine(row, campaign, formatOf(row))}
                    </span>
                  )}
                </span>
                <span className="truncate text-[12.5px] text-ink-muted">{row.targetLanguage}</span>
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
            ))}
          </div>

          {/* Mobile: stacked cards */}
          <div className="flex flex-col gap-1 md:hidden">
            {Array.from(campaigns.entries()).map(([campaign, campaignRows]) => (
              <div key={campaign} className="border-b border-edge py-1 last:border-b-0">
                <p className="px-3.5 pb-1 pt-2 text-[12px] font-bold text-ink">
                  {campaign}
                  <span className="ml-2 text-[11px] font-normal text-ink-faint">
                    {campaignRows.length} {campaignRows.length === 1 ? "format" : "formats"}
                  </span>
                </p>
                {campaignRows.map((row) => (
              <Link
                key={row.id}
                href={studioContentUrl(row.id, row.sizeKey ?? undefined, contentReturnTo)}
                className="flex flex-col gap-1.5 rounded-control px-3.5 py-3 transition-colors hover:bg-page"
              >
                {/* Same reasoning as the desktop table: the campaign already
                    heads the group, so the card leads with the format. */}
                <span className="truncate text-[13.5px] font-semibold">
                  {formatOf(row)}
                </span>
                <span className="truncate text-[11.5px] text-ink-faint">
                  {[secondaryLine(row, campaign, formatOf(row)), row.targetLanguage]
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
