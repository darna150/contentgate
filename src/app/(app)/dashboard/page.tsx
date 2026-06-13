import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusPill } from "@/components/status-pill";

type RecentRow = {
  id: string;
  title: string;
  status: string;
  target_language: string;
  created_at: string;
};

export default async function DashboardPage() {
  let docCount: number | null = null;
  let contentCount: number | null = null;
  let pendingCount: number | null = null;
  let recent: RecentRow[] = [];

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const [docs, content, pending, recentRes] = await Promise.all([
      supabase.from("documents").select("id", { count: "exact", head: true }),
      supabase.from("generated_content").select("id", { count: "exact", head: true }),
      supabase
        .from("generated_content")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_review"),
      supabase
        .from("generated_content")
        .select("id, title, status, target_language, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    docCount = docs.count ?? 0;
    contentCount = content.count ?? 0;
    pendingCount = pending.count ?? 0;
    recent = recentRes.data ?? [];
  }

  const cards = [
    {
      label: "Documents",
      value: docCount,
      hint: "in the Knowledge Hub",
      href: "/knowledge",
    },
    {
      label: "Generated content",
      value: contentCount,
      hint: "drafts and approved",
      href: "/content",
    },
    {
      label: "Awaiting approval",
      value: pendingCount,
      hint: "in the queue",
      href: "/approvals",
    },
  ];

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-semibold">Dashboard</h1>
        <p className="text-[14.5px] text-ink-muted">
          Recent content and what&apos;s waiting on approval.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="flex flex-col gap-1 rounded-card border border-edge bg-surface p-6 transition-colors hover:border-brand"
          >
            <span className="text-[13px] font-semibold text-ink-muted">
              {card.label}
            </span>
            <span className="font-serif text-3xl font-semibold">
              {card.value ?? "—"}
            </span>
            <span className="text-xs text-ink-faint">{card.hint}</span>
          </Link>
        ))}
      </div>

      {docCount === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-16 text-center">
          <p className="text-[15px] font-semibold">Start with your documents</p>
          <p className="max-w-md text-sm text-ink-muted">
            Add approved product guides and claim sheets to the Knowledge Hub —
            everything ContentGate generates is grounded in them.
          </p>
          <Link
            href="/knowledge/new"
            className="mt-2 rounded-control bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Add a document
          </Link>
        </div>
      ) : recent.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-16 text-center">
          <p className="text-[15px] font-semibold">Ready to generate</p>
          <p className="max-w-md text-sm text-ink-muted">
            Your Knowledge Hub has sources. Pick a product to generate your
            first piece of content.
          </p>
          <Link
            href="/products"
            className="mt-2 rounded-control bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Generate content
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5 rounded-card border border-edge bg-surface p-[22px]">
          <div className="flex items-center">
            <h2 className="text-[15px] font-bold">Recent content</h2>
            <div className="flex-1" />
            <Link
              href="/content"
              className="text-[13px] font-semibold text-brand hover:underline"
            >
              View all →
            </Link>
          </div>
          <ul className="flex flex-col gap-0.5">
            {recent.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/content/${row.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-page"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-semibold">
                      {row.title}
                    </span>
                    <span className="text-[11.5px] text-ink-faint">
                      {row.target_language} ·{" "}
                      {new Date(row.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </span>
                  <StatusPill status={row.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
