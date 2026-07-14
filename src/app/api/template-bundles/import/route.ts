import { createClient } from "@/lib/supabase/server";
import { importTemplateBundle } from "@/lib/template-platform/importer";
import { createSupabaseTemplateBundleRepository } from "@/lib/template-platform/supabase-repository";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";

export const runtime = "nodejs";
export const maxDuration = 60;

type ImportAssetBody = {
  path: string;
  dataBase64: string;
  contentType?: string;
};

type ImportBody = {
  manifest: TemplateBundleManifest;
  assets: ImportAssetBody[];
  storagePrefix?: string;
};

function isAssetBody(value: unknown): value is ImportAssetBody {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as ImportAssetBody).path === "string" &&
    typeof (value as ImportAssetBody).dataBase64 === "string" &&
    ((value as ImportAssetBody).contentType == null ||
      typeof (value as ImportAssetBody).contentType === "string")
  );
}

function defaultStoragePrefix(manifest: TemplateBundleManifest) {
  return [
    "template-bundles",
    manifest.family.key,
    manifest.version.name,
  ].join("/");
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: Response.json({ error: "No profile." }, { status: 401 }) };
  if (profile.role !== "admin") {
    return { error: Response.json({ error: "Admins only." }, { status: 403 }) };
  }

  return {
    value: {
      orgId: profile.org_id as string,
      userId: user.id,
    },
  };
}

export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "Template import is not configured." }, { status: 503 });
  }

  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;

  let body: ImportBody;
  try {
    body = (await req.json()) as ImportBody;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body?.manifest || !Array.isArray(body.assets) || !body.assets.every(isAssetBody)) {
    return Response.json({ error: "Manifest and asset payloads are required." }, { status: 400 });
  }

  const assets = body.assets.map((asset) => ({
    path: asset.path,
    data: Buffer.from(asset.dataBase64, "base64"),
    contentType: asset.contentType,
  }));

  try {
    const result = await importTemplateBundle(
      {
        manifest: body.manifest,
        assets,
        orgId: admin.value.orgId,
        createdBy: admin.value.userId,
        storagePrefix: body.storagePrefix ?? defaultStoragePrefix(body.manifest),
      },
      createSupabaseTemplateBundleRepository()
    );

    if (!result.ok) {
      return Response.json({ error: "Template bundle failed validation.", issues: result.issues }, { status: 400 });
    }

    return Response.json({
      templateFamilyId: result.value.rows.family.id,
      templateVersionId: result.value.rows.version.id,
      manifestSha256: result.value.manifestSha256,
      variants: result.value.rows.variants.map((variant) => ({
        id: variant.id,
        key: variant.variant_key,
        width: variant.width,
        height: variant.height,
      })),
    });
  } catch (error) {
    console.error("template bundle import failed:", error);
    return Response.json({ error: "Template bundle import failed." }, { status: 500 });
  }
}
