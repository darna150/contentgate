import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminMfaRequest } from "@/lib/auth/admin-mfa";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import { buildProductTemplateAssignmentUpsert } from "@/lib/template-platform/publishing";
import {
  decideTemplateVersionStorageIntegrity,
  type TemplateVersionStorageIntegrity,
} from "@/lib/template-platform/storage-integrity";

export const runtime = "nodejs";

type AssignBody = {
  productId?: string;
  templateVersionId?: string;
  defaultVariantKey?: string | null;
  generationProfile?: unknown;
  defaultPayload?: unknown;
  allowedLocales?: unknown;
};

export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "Template assignment is not configured." }, { status: 503 });
  }

  const admin = await requireAdminMfaRequest();
  if ("error" in admin) return admin.error;

  let body: AssignBody;
  try {
    body = (await req.json()) as AssignBody;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.productId || !body.templateVersionId) {
    return Response.json(
      { error: "productId and templateVersionId are required." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, org_id")
    .eq("id", body.productId)
    .eq("org_id", admin.value.orgId)
    .single();
  if (productError || !product) {
    return Response.json({ error: "Product not found." }, { status: 404 });
  }

  const { data: version, error: versionError } = await supabase
    .from("template_versions")
    .select("id, org_id, family_id, status, manifest")
    .eq("id", body.templateVersionId)
    .eq("org_id", admin.value.orgId)
    .single();
  if (versionError || !version) {
    return Response.json({ error: "Template version not found." }, { status: 404 });
  }
  if (version.status !== "published") {
    return Response.json(
      { error: "Template version must be published before assignment." },
      { status: 409 }
    );
  }

  const { data: integrityRows, error: integrityError } = await supabase.rpc(
    "template_version_storage_integrity",
    {
      p_template_version_id: version.id,
      p_org_id: admin.value.orgId,
    }
  );
  const integrity = decideTemplateVersionStorageIntegrity(
    (Array.isArray(integrityRows) ? integrityRows[0] : integrityRows) as
      | TemplateVersionStorageIntegrity
      | null
  );
  if (integrityError || !integrity.ok) {
    return Response.json(
      {
        error: "Template version storage is incomplete and cannot be assigned.",
        missingAssetKeys: integrity.ok ? [] : integrity.missingAssetKeys,
      },
      { status: 409 }
    );
  }

  const assignment = buildProductTemplateAssignmentUpsert({
    orgId: admin.value.orgId,
    productId: product.id,
    templateFamilyId: version.family_id,
    templateVersionId: version.id,
    manifest: version.manifest as TemplateBundleManifest,
    defaultVariantKey: body.defaultVariantKey,
    generationProfile: body.generationProfile,
    defaultPayload: body.defaultPayload,
    allowedLocales: body.allowedLocales,
  });
  if (!assignment.ok) {
    return Response.json({ error: assignment.reason }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: row, error: assignmentError } = await supabase
    .from("product_template_assignments")
    .upsert(
      {
        ...assignment.row,
        updated_at: now,
      },
      { onConflict: "org_id,product_id,template_family_id" }
    )
    .select("id, product_id, template_family_id, template_version_id, default_variant_key")
    .single();
  if (assignmentError || !row) {
    return Response.json({ error: "Failed to assign template to product." }, { status: 500 });
  }

  return Response.json({
    assignmentId: row.id,
    productId: row.product_id,
    templateFamilyId: row.template_family_id,
    templateVersionId: row.template_version_id,
    defaultVariantKey: row.default_variant_key,
  });
}
