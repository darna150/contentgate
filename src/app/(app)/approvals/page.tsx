import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type QueueRow = {
  id: string;
  title: string;
  target_language: string;
  audience: string | null;
  created_at: string;
  templates: { name: string } | { name: string }[] | null;
  creator: { full_name: string | null } | { full_name: string | null }[] | null;
};

export default async function ApprovalsPage() {
  let rows: QueueRow[] = [];
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("generated_content")
      .select(
        "id, title, target_language, audience, created_at, templates(name), creator:profiles!generated_content_created_by_fkey(full_name)"
      )
      .eq("status", "in_review")
      .order("created_at", { ascending: true });
    rows = (data as QueueRow[]) ?? [];
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-semibold">Approval Queue</h1>
        <p className="text-[14.5px] text-ink-muted">
          Content waiting for review. Only approved content can be exported.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-16 text-center">
          <p className="text-[15px] font-semibold">The queue is clear</p>
          <p className="max-w-md text-sm text-ink-muted">
            When someone submits content for review, it lands here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1 rounded-card border border-edge bg-surface p-3">
          {rows.map((row) => {
            const template = Array.isArray(row.templates)
              ? row.templates[0]
              : row.templates;
            const creator = Array.isArray(row.creator)
              ? row.creator[0]
              : row.creator;
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
                    {template?.name ?? "Custom"} · {row.target_language}
                    {row.audience ? ` · ${row.audience}` : ""} · submitted by{" "}
                    {creator?.full_name ?? "a teammate"} ·{" "}
                    {new Date(row.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </span>
                <span className="inline-flex rounded-full bg-[#FBF3E2] px-[9px] py-0.5 text-[11.5px] font-semibold text-warn">
                  In review
                </span>
                <span className="text-[13px] font-semibold text-brand">
                  Review →
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
