import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function AskQualityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "admin") redirect("/ask");

  const [{ data: queries }, { data: feedback }] = await Promise.all([
    supabase
      .from("knowledge_queries")
      .select("id, not_found, retrieval_strategy, answer_latency_ms, verified_claim_count, created_at")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("knowledge_query_feedback")
      .select("query_id, rating, reason, created_at")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const recentQueries = queries ?? [];
  const recentFeedback = feedback ?? [];
  const unhelpful = recentFeedback.filter((item) => item.rating === -1);
  const latency = recentQueries
    .map((item) => item.answer_latency_ms)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);
  const p95 = latency.length > 0 ? latency[Math.min(latency.length - 1, Math.ceil(latency.length * 0.95) - 1)] : null;
  const reasons = Object.entries(
    unhelpful.reduce<Record<string, number>>((total, item) => {
      total[item.reason ?? "unclassified"] = (total[item.reason ?? "unclassified"] ?? 0) + 1;
      return total;
    }, {})
  ).sort((left, right) => right[1] - left[1]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <div><p className="text-label text-brand">Ask quality</p><h1 className="mt-1 text-2xl font-semibold text-ink">Evidence and feedback review</h1></div>
        <Button asChild variant="outline"><Link href="/ask">Back to Ask</Link></Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Questions", recentQueries.length],
          ["No-evidence", recentQueries.filter((item) => item.not_found).length],
          ["Unhelpful", unhelpful.length],
          ["p95 latency", p95 === null ? "—" : `${(p95 / 1000).toFixed(1)}s`],
        ].map(([label, value]) => <Card key={String(label)} className="gap-1 p-4"><p className="text-[12px] text-ink-faint">{label}</p><p className="text-2xl font-semibold text-ink">{value}</p></Card>)}
      </div>
      <Card className="gap-3 p-5"><h2 className="font-semibold text-ink">Unhelpful-answer reasons</h2>{reasons.length === 0 ? <p className="text-sm text-ink-muted">No categorized feedback yet.</p> : <div className="flex flex-wrap gap-2">{reasons.map(([reason, count]) => <span key={reason} className="rounded-full border border-edge bg-page px-3 py-1.5 text-sm text-ink-muted">{reason.replace("_", " ")} · {count}</span>)}</div>}</Card>
      <Card className="gap-3 p-5"><h2 className="font-semibold text-ink">Review queue</h2>{unhelpful.length === 0 ? <p className="text-sm text-ink-muted">No low-rated answers in the latest sample.</p> : <ul className="space-y-2">{unhelpful.slice(0, 10).map((item) => <li key={item.query_id} className="rounded border border-edge bg-page px-3 py-2 text-sm text-ink-muted">{item.reason ?? "Uncategorized"} · answer {item.query_id.slice(0, 8)} · {new Date(item.created_at).toLocaleDateString()}</li>)}</ul>}</Card>
    </div>
  );
}
