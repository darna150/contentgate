import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusPill } from "@/components/status-pill";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "in_review", label: "In review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

type Joined<T> = T | T[] | null;
type ContentRow = {
  id: string;
  title: string;
  status: string;
  target_language: string;
  audience: string | null;
  created_at: string;
  products: Joined<{ name: string }>;
  product_templates: Joined<{ variant: string }>;
  template_versions: Joined<{
    version_label: string;
    template_families: Joined<{ name: string }>;
  }>;
  template_variants: Joined<{ label: string; variant_key: string }>;
};

function one<T>(v: Joined<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = FILTERS.some((f) => f.key === status) ? status! : "all";

  let rows: ContentRow[] = [];
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    let query = supabase
      .from("generated_content")
      .select(
        "id, title, status, target_language, audience, created_at, products(name), product_templates(variant), template_versions(version_label, template_families(name)), template_variants(label, variant_key)"
      )
      .not("product_id", "is", null)
      .order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    rows = (data as ContentRow[]) ?? [];
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
            const product = one(row.products);
            const template = one(row.product_templates);
            const templateVersion = one(row.template_versions);
            const templateFamily = one(templateVersion?.template_families);
            const templateVariant = one(row.template_variants);
            const platformTemplateLabel = [
              templateFamily?.name,
              templateVariant?.label ?? templateVariant?.variant_key,
            ]
              .filter(Boolean)
              .join(" · ");
            const meta = [
              product?.name,
              template?.variant ?? platformTemplateLabel,
              row.target_language,
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
                    {new Date(row.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </span>
                <StatusPill status={row.status} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
