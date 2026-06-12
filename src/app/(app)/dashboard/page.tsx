import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  let docCount: number | null = null;
  let contentCount: number | null = null;
  let pendingCount: number | null = null;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const [docs, content, pending] = await Promise.all([
      supabase.from("documents").select("id", { count: "exact", head: true }),
      supabase.from("generated_content").select("id", { count: "exact", head: true }),
      supabase
        .from("generated_content")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_review"),
    ]);
    docCount = docs.count ?? 0;
    contentCount = content.count ?? 0;
    pendingCount = pending.count ?? 0;
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
      href: "/generate",
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
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-16 text-center">
          <p className="text-[15px] font-semibold">Content generation lands on Day 3</p>
          <p className="max-w-md text-sm text-ink-muted">
            The Content Generator, Template Library, and Approval Queue arrive
            over the next sprint days.
          </p>
        </div>
      )}
    </div>
  );
}
