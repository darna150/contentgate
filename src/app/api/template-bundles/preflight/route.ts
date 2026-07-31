import { createClient } from "@/lib/supabase/server";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import {
  preflightTemplateBundle,
  type TemplateBundlePreflightSample,
} from "@/lib/template-platform/preflight";
import {
  logTemplatePipelineEvent,
  templatePipelineDuration,
} from "@/lib/template-platform/observability";

export const runtime = "nodejs";
export const maxDuration = 60;

type PreflightAssetBody = {
  path: string;
  dataBase64: string;
  contentType?: string;
};

type PreflightBody = {
  manifest: TemplateBundleManifest;
  assets: PreflightAssetBody[];
  samples?: TemplateBundlePreflightSample[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isAssetBody(value: unknown): value is PreflightAssetBody {
  return (
    isRecord(value) &&
    typeof value.path === "string" &&
    typeof value.dataBase64 === "string" &&
    (value.contentType == null || typeof value.contentType === "string")
  );
}

function isPreflightSample(value: unknown): value is TemplateBundlePreflightSample {
  return (
    isRecord(value) &&
    typeof value.key === "string" &&
    (value.label == null || typeof value.label === "string") &&
    isRecord(value.fields)
  );
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: Response.json({ error: "No profile." }, { status: 401 }) };
  if (profile.role !== "admin") {
    return { error: Response.json({ error: "Admins only." }, { status: 403 }) };
  }

  return { value: true };
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;

  let body: PreflightBody;
  try {
    body = (await req.json()) as PreflightBody;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body?.manifest || !Array.isArray(body.assets) || !body.assets.every(isAssetBody)) {
    return Response.json({ error: "Manifest and asset payloads are required." }, { status: 400 });
  }

  if (body.samples != null && (!Array.isArray(body.samples) || !body.samples.every(isPreflightSample))) {
    return Response.json({ error: "Samples must include key and fields." }, { status: 400 });
  }

  const assets = body.assets.map((asset) => ({
    path: asset.path,
    data: Buffer.from(asset.dataBase64, "base64"),
  }));

  try {
    const report = await preflightTemplateBundle({
      manifest: body.manifest,
      assets,
      samples: body.samples,
    });
    logTemplatePipelineEvent({
      event: "template.preflight",
      ok: report.ok,
      familyKey: body.manifest.family?.key,
      versionName: body.manifest.version?.name,
      issueCount: report.issues.length,
      assetCount: body.assets.length,
      damBoundFieldCount: body.manifest.fields?.filter(
        (field) => field.assetBinding?.source === "product_assets"
      ).length,
      durationMs: templatePipelineDuration(startedAt),
    });

    return Response.json({
      report,
      ok: report.ok,
      issues: report.issues,
    });
  } catch (error) {
    console.error("template bundle preflight failed:", error);
    logTemplatePipelineEvent({
      event: "template.preflight",
      ok: false,
      familyKey: body?.manifest?.family?.key,
      versionName: body?.manifest?.version?.name,
      durationMs: templatePipelineDuration(startedAt),
      reason: "exception",
    });
    return Response.json({ error: "Template bundle preflight failed." }, { status: 500 });
  }
}
