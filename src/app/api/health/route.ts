import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ASSET_MEDIA_PROCESSING_SLO_MS = Number(
  process.env.ASSET_MEDIA_PROCESSING_SLO_MS ?? 60_000
);

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const response = await fetch(`${url}/rest/v1/organizations?select=id&limit=1`, {
      method: "HEAD",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);

    const admin = createAdminClient();
    const { data: renderBucket, error: bucketError } = await admin.storage.getBucket(
      "rendered-assets"
    );
    if (bucketError || !renderBucket) {
      throw new Error(
        `Supabase rendered-assets bucket unavailable: ${
          bucketError?.message ?? "not found"
        }`
      );
    }
    const { data: templateBucket, error: templateBucketError } =
      await admin.storage.getBucket("template-bundles");
    if (templateBucketError || !templateBucket) {
      throw new Error(
        `Supabase template-bundles bucket unavailable: ${
          templateBucketError?.message ?? "not found"
        }`
      );
    }
    const { data: worker, error: workerError } = await admin
      .from("asset_media_worker_heartbeats")
      .select("worker_id, last_seen_at, status")
      .eq("status", "healthy")
      .gte("last_seen_at", new Date(Date.now() - 2 * 60 * 1_000).toISOString())
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    // Asset processing is an asynchronous enhancement. A fresh web release
    // should remain healthy before an optional worker has started sending
    // heartbeats; the readiness signal is reported separately for operators.
    if (workerError) {
      throw new Error(`Asset media worker status unavailable: ${workerError.message}`);
    }
    const processingCutoff = new Date(
      Date.now() - Math.max(1_000, ASSET_MEDIA_PROCESSING_SLO_MS)
    ).toISOString();
    const { data: overdueMediaJob, error: overdueMediaJobError } = worker
      ? await admin
          .from("asset_media_jobs")
          .select("id, job_type, started_at")
          .eq("status", "running")
          .lt("started_at", processingCutoff)
          .order("started_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      : { data: null, error: null };
    if (overdueMediaJobError) {
      throw new Error(overdueMediaJobError.message);
    }

    return NextResponse.json(
      {
        status: "ok",
        checks: {
          supabase: "ok",
          renderedAssetsBucket: "ok",
          templateBundlesBucket: "ok",
          assetMediaWorker: worker ? "ok" : "not_configured",
          assetMediaProcessingSlo: worker
            ? overdueMediaJob
              ? "overdue"
              : "ok"
            : "not_monitored",
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("health check failed", error);
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
