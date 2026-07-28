import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ASK_OPERATIONAL_GATES,
  checkAskOperationalGates,
  type AskOutcome,
} from "@/lib/ask-quality";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const WINDOW_DAYS = 30;

type QueryMetric = {
  id: string;
  outcome: AskOutcome;
  not_found: boolean;
  retrieval_strategy: string;
  answer_latency_ms: number | null;
  verified_claim_count: number;
  candidate_claim_count: number;
  estimated_cost_usd: number | string | null;
  failure_code: string | null;
  deployment_commit_sha: string | null;
  created_at: string;
};

function percentile(values: number[], value: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)];
}

function percent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function milliseconds(value: number | null) {
  return value === null ? "—" : `${(value / 1000).toFixed(1)}s`;
}

function usd(value: number | null) {
  return value === null ? "—" : `$${value.toFixed(4)}`;
}

export default async function AskQualityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.role !== "admin") redirect("/ask");

  // This authenticated Server Component is rendered dynamically; the rolling
  // quality window intentionally uses request-time wall-clock time.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const querySelection =
    "id, outcome, not_found, retrieval_strategy, answer_latency_ms, verified_claim_count, candidate_claim_count, estimated_cost_usd, failure_code, deployment_commit_sha, created_at";
  const [{ data: userRows }, { data: syntheticRows }] = await Promise.all([
    supabase
      .from("knowledge_queries")
      .select(querySelection)
      .eq("org_id", profile.org_id)
      .eq("deployment_environment", "production")
      .eq("traffic_class", "user")
      .neq("outcome", "legacy")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1_000),
    supabase
      .from("knowledge_queries")
      .select(querySelection)
      .eq("org_id", profile.org_id)
      .eq("deployment_environment", "production")
      .eq("traffic_class", "synthetic")
      .neq("outcome", "legacy")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const queries = (userRows ?? []) as QueryMetric[];
  const synthetic = (syntheticRows ?? []) as QueryMetric[];
  const queryIds = queries.map((query) => query.id);
  const { data: feedbackRows } = queryIds.length
    ? await supabase
        .from("knowledge_query_feedback")
        .select("query_id, rating, reason, created_at")
        .eq("org_id", profile.org_id)
        .in("query_id", queryIds)
        .order("created_at", { ascending: false })
        .limit(1_000)
    : { data: [] };
  const feedback = feedbackRows ?? [];

  const answered = queries.filter((query) => query.outcome === "answered");
  const failures = queries.filter(
    (query) => query.outcome === "provider_error" || query.outcome === "verification_error"
  );
  const noEvidence = queries.filter((query) => query.outcome === "no_evidence");
  const groundedAnswers = answered.filter((query) => query.verified_claim_count > 0);
  const latency = queries.flatMap((query) =>
    typeof query.answer_latency_ms === "number" ? [query.answer_latency_ms] : []
  );
  const costs = queries.flatMap((query) => {
    if (query.estimated_cost_usd === null) return [];
    const value = Number(query.estimated_cost_usd);
    return Number.isFinite(value) ? [value] : [];
  });
  const helpful = feedback.filter((item) => item.rating === 1).length;
  const unhelpful = feedback.filter((item) => item.rating === -1);
  const metrics = {
    sampleSize: queries.length,
    answeredCount: answered.length,
    groundedAnswerRate:
      answered.length > 0 ? groundedAnswers.length / answered.length : 1,
    failureRate: queries.length > 0 ? failures.length / queries.length : 0,
    p95LatencyMs: percentile(latency, 0.95),
    averageCostUsd:
      costs.length > 0 ? costs.reduce((total, value) => total + value, 0) / costs.length : null,
    feedbackCount: feedback.length,
    helpfulFeedbackRate: feedback.length > 0 ? helpful / feedback.length : null,
  };
  const gate = checkAskOperationalGates(metrics);
  const reasons = Object.entries(
    unhelpful.reduce<Record<string, number>>((total, item) => {
      total[item.reason ?? "unclassified"] = (total[item.reason ?? "unclassified"] ?? 0) + 1;
      return total;
    }, {})
  ).sort((left, right) => right[1] - left[1]);
  const strategies = Object.entries(
    queries.reduce<Record<string, number>>((total, item) => {
      total[item.retrieval_strategy] = (total[item.retrieval_strategy] ?? 0) + 1;
      return total;
    }, {})
  ).sort((left, right) => right[1] - left[1]);
  const latestSynthetic = synthetic[0] ?? null;
  const latestSyntheticCommit = latestSynthetic?.deployment_commit_sha ?? null;
  const latestSyntheticRun = latestSyntheticCommit
    ? synthetic.filter((query) => query.deployment_commit_sha === latestSyntheticCommit)
    : latestSynthetic
      ? [latestSynthetic]
      : [];
  const syntheticPassed =
    latestSyntheticRun.some((query) => query.outcome === "answered") &&
    latestSyntheticRun.some((query) => query.outcome === "no_evidence") &&
    !latestSyntheticRun.some(
      (query) => query.outcome === "provider_error" || query.outcome === "verification_error"
    );

  const statusTone =
    gate.status === "passing"
      ? "bg-approve/10 text-approve"
      : gate.status === "failing"
        ? "bg-reject/10 text-reject"
        : "bg-page text-ink-muted";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-label text-brand">Ask quality</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">Production evidence and reliability</h1>
          <p className="mt-1 text-sm text-ink-muted">
            User traffic only · production deployment · trailing {WINDOW_DAYS} days
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${statusTone}`}>
            {gate.status === "passing"
              ? "Operational gates passing"
              : gate.status === "failing"
                ? "Operational gates failing"
                : "Collecting baseline"}
          </span>
          <Button asChild variant="outline"><Link href="/ask">Back to Ask</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Production questions", queries.length],
          ["Grounded answers", percent(metrics.groundedAnswerRate)],
          ["Safe no-evidence", noEvidence.length],
          ["Answer failures", percent(metrics.failureRate)],
          ["p50 latency", milliseconds(percentile(latency, 0.5))],
          ["p95 latency", milliseconds(metrics.p95LatencyMs)],
          ["Average API cost", usd(metrics.averageCostUsd)],
          ["Helpful ratings", percent(metrics.helpfulFeedbackRate)],
        ].map(([label, value]) => (
          <Card key={String(label)} className="gap-1 p-4">
            <p className="text-[12px] text-ink-faint">{label}</p>
            <p className="text-2xl font-semibold text-ink">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-3 p-5">
          <h2 className="font-semibold text-ink">Operational release gates</h2>
          <div className="space-y-2 text-sm text-ink-muted">
            <p>Grounded answers ≥ {(ASK_OPERATIONAL_GATES.minGroundedAnswerRate * 100).toFixed(0)}% · current {percent(metrics.groundedAnswerRate)}</p>
            <p>Failures ≤ {(ASK_OPERATIONAL_GATES.maxFailureRate * 100).toFixed(0)}% · current {percent(metrics.failureRate)}</p>
            <p>p95 latency ≤ {(ASK_OPERATIONAL_GATES.maxP95LatencyMs / 1000).toFixed(0)}s · current {milliseconds(metrics.p95LatencyMs)}</p>
            <p>Average cost ≤ ${ASK_OPERATIONAL_GATES.maxAverageCostUsd.toFixed(2)} · current {usd(metrics.averageCostUsd)}</p>
            <p>Helpful ratings ≥ {(ASK_OPERATIONAL_GATES.minHelpfulFeedbackRate * 100).toFixed(0)}% · current {percent(metrics.helpfulFeedbackRate)}</p>
          </div>
          {gate.failures.map((failure) => <p key={failure} className="text-sm font-medium text-reject">Failing: {failure}</p>)}
          {gate.warnings.map((warning) => <p key={warning} className="text-sm text-ink-faint">{warning}</p>)}
        </Card>

        <Card className="gap-3 p-5">
          <h2 className="font-semibold text-ink">Production acceptance</h2>
          {latestSynthetic ? (
            <div className="space-y-2 text-sm text-ink-muted">
              <p className={syntheticPassed ? "font-medium text-approve" : "font-medium text-reject"}>
                {syntheticPassed ? "Grounded and no-evidence checks passed" : "Latest validation window is incomplete or failed"}
              </p>
              <p>Latest run: {new Date(latestSynthetic.created_at).toLocaleString()}</p>
              <p>Commit: {latestSynthetic.deployment_commit_sha?.slice(0, 7) ?? "unknown"}</p>
              <p>{latestSyntheticRun.length} checks recorded for this commit; excluded from user metrics.</p>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">No post-deploy Ask acceptance run has been recorded yet.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-3 p-5">
          <h2 className="font-semibold text-ink">Retrieval strategies</h2>
          {strategies.length === 0 ? <p className="text-sm text-ink-muted">No production user traffic in this window.</p> : <div className="flex flex-wrap gap-2">{strategies.map(([strategy, count]) => <span key={strategy} className="rounded-full border border-edge bg-page px-3 py-1.5 text-sm text-ink-muted">{strategy.replaceAll("_", " ")} · {count}</span>)}</div>}
        </Card>
        <Card className="gap-3 p-5">
          <h2 className="font-semibold text-ink">Unhelpful-answer reasons</h2>
          {reasons.length === 0 ? <p className="text-sm text-ink-muted">No categorized production feedback yet.</p> : <div className="flex flex-wrap gap-2">{reasons.map(([reason, count]) => <span key={reason} className="rounded-full border border-edge bg-page px-3 py-1.5 text-sm text-ink-muted">{reason.replaceAll("_", " ")} · {count}</span>)}</div>}
        </Card>
      </div>

      <Card className="gap-2 p-5 text-sm text-ink-muted">
        <h2 className="font-semibold text-ink">Measurement contract</h2>
        <p>Preview deployments, automated acceptance traffic, and historical rows without the current telemetry contract are excluded from user-quality gates.</p>
        <p>Cost is an estimate from OpenAI-reported token usage and the app&apos;s explicit model-price registry. Unknown models report no estimate instead of an invented value.</p>
      </Card>
    </div>
  );
}
