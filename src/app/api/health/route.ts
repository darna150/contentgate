import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

    return NextResponse.json(
      {
        status: "ok",
        checks: {
          supabase: "ok",
          renderedAssetsBucket: "ok",
          templateBundlesBucket: "ok",
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
