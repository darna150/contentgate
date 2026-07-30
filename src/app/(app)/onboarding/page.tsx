import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformOperator } from "@/lib/onboarding/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingPanel } from "./onboarding-panel";

export const runtime = "nodejs";

export default async function OnboardingPage() {
  try {
    await requirePlatformOperator();
  } catch {
    redirect("/dashboard");
  }

  const { data: runs } = await createAdminClient()
    .from("onboarding_runs")
    .select("id, workspace_key, environment, status, current_step, error_message, created_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <PageHeader
        eyebrow="Platform operations"
        title="Create a client workspace"
        description="Upload one reviewed package, validate every reference without writes, then create the isolated workspace from the same immutable package."
      />
      <OnboardingPanel environment={process.env.CONTENTGATE_ENVIRONMENT ?? null} />
      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
          <CardDescription>Cross-environment audit status for the last ten onboarding attempts.</CardDescription>
        </CardHeader>
        <CardContent>
          {runs?.length ? (
            <ul className="flex flex-col divide-y divide-border">
              {runs.map((run) => (
                <li key={run.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-small font-semibold text-ink">{run.workspace_key}</p>
                    <p className="text-caption text-ink-muted">
                      {run.environment} · {run.current_step} · {new Date(run.created_at).toLocaleString()}
                    </p>
                    {run.error_message ? <p className="mt-1 line-clamp-2 text-caption text-reject">{run.error_message}</p> : null}
                  </div>
                  <Badge
                    variant={
                      run.status === "completed"
                        ? "approve"
                        : run.status === "failed" || run.status === "rolled_back"
                          ? "reject"
                          : "warn"
                    }
                    className="w-fit capitalize"
                  >
                    {run.status.replace("_", " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-ink-muted">No onboarding runs yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
