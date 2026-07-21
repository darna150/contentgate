import { createClient } from "@/lib/supabase/server";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Admin-only. Shows real usage of the Knowledge Hub: how many questions have
// been asked, how many fell outside approved sources, and the recent ones.
export async function ActivityPanel() {
  const supabase = await createClient();

  const { count: total } = await supabase
    .from("knowledge_queries")
    .select("*", { count: "exact", head: true });

  const { count: unanswered } = await supabase
    .from("knowledge_queries")
    .select("*", { count: "exact", head: true })
    .eq("not_found", true);

  const { data: recent } = await supabase
    .from("knowledge_queries")
    .select(
      "id, question, not_found, created_at, products!knowledge_queries_product_id_fkey(name), profiles!knowledge_queries_user_id_fkey(full_name)"
    )
    .order("created_at", { ascending: false })
    .limit(8);

  const rows = recent ?? [];

  return (
    <div className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-[22px]">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-bold">Activity</h2>
        <span className="rounded-[5px] bg-brand-tint px-[7px] py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-brand">
          Admin
        </span>
      </div>

      {/* Stat row */}
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-0.5 rounded-[10px] border border-edge bg-page px-4 py-3">
          <span className="text-[24px] font-bold leading-none text-ink">{total ?? 0}</span>
          <span className="text-[11.5px] text-ink-faint">Questions asked</span>
        </div>
        <div className="flex flex-1 flex-col gap-0.5 rounded-[10px] border border-edge bg-page px-4 py-3">
          <span className="text-[24px] font-bold leading-none text-ink">{unanswered ?? 0}</span>
          <span className="text-[11.5px] text-ink-faint">Outside approved sources</span>
        </div>
      </div>

      {/* Recent questions */}
      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-faint">No questions asked yet.</p>
      ) : (
        <div className="flex flex-col">
          <span className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-faint">
            Recent questions
          </span>
          <ul className="flex flex-col">
            {rows.map((q) => {
              const product = Array.isArray(q.products) ? q.products[0] : q.products;
              const asker = Array.isArray(q.profiles) ? q.profiles[0] : q.profiles;
              return (
                <li
                  key={q.id}
                  className="flex items-start gap-3 border-b border-edge py-2.5 last:border-0"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[13px] font-medium text-ink">{q.question}</span>
                    <span className="text-[11.5px] text-ink-faint">
                      {product?.name ?? "All sources"}
                      {asker?.full_name ? ` · ${asker.full_name}` : ""}
                    </span>
                  </div>
                  {q.not_found && (
                    <span className="mt-0.5 whitespace-nowrap rounded-[5px] bg-reject-tint px-[6px] py-0.5 text-[9.5px] font-bold uppercase tracking-[0.05em] text-reject">
                      No match
                    </span>
                  )}
                  <span className="mt-0.5 whitespace-nowrap text-[11px] text-ink-faint">
                    {timeAgo(q.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
