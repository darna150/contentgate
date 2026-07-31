import { NextResponse } from "next/server";
import { GET as healthCheck } from "@/app/api/health/route";
import { deliverIncidentAlert } from "@/lib/incident-alert";

export const dynamic = "force-dynamic";

/**
 * Vercel invokes this route on the schedule in vercel.json.  A configured
 * CRON_SECRET keeps it from becoming a public error-log generator; Vercel
 * automatically supplies the matching bearer token to scheduled invocations.
 */
export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    console.error(JSON.stringify({
      level: "error",
      message: "asset health cron is missing CRON_SECRET",
      route: "/api/cron/asset-health",
    }));
    return NextResponse.json({ status: "unconfigured" }, { status: 503 });
  }
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const response = await healthCheck();
  const result = (await response.clone().json().catch(() => null)) as unknown;
  const event = {
    route: "/api/cron/asset-health",
    status: response.status,
    duration_ms: Date.now() - startedAt,
    result,
  };

  if (!response.ok) {
    console.error(JSON.stringify({ level: "error", message: "asset platform health check failed", ...event }));
    try {
      const alert = await deliverIncidentAlert({
        severity: "P1",
        service: "contentgate-health",
        summary: "ContentGate health check failed",
        occurredAt: new Date().toISOString(),
        environment: process.env.CONTENTGATE_ENVIRONMENT ?? "unknown",
        deployment: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        details: event,
      });
      if (alert.status === "unconfigured") {
        console.error(JSON.stringify({
          level: "error",
          message: "incident delivery is not configured",
          route: "/api/cron/asset-health",
        }));
      }
    } catch (error) {
      console.error(JSON.stringify({
        level: "error",
        message: "incident delivery failed",
        route: "/api/cron/asset-health",
        error: error instanceof Error ? error.message : "unknown error",
      }));
    }
  } else {
    console.log(JSON.stringify({ level: "info", message: "asset platform health check passed", ...event }));
  }

  return NextResponse.json(result, {
    status: response.status,
    headers: { "Cache-Control": "no-store" },
  });
}
