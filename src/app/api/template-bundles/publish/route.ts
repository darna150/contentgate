import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { decideTemplateVersionPublish } from "@/lib/template-platform/publishing";

export const runtime = "nodejs";

type PublishBody = {
  templateVersionId?: string;
};

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
    return Response.json({ error: "Template publishing is not configured." }, { status: 503 });
  }

  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;

  let body: PublishBody;
  try {
    body = (await req.json()) as PublishBody;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.templateVersionId) {
    return Response.json({ error: "templateVersionId is required." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: version, error: versionError } = await supabase
    .from("template_versions")
    .select("id, org_id, family_id, status")
    .eq("id", body.templateVersionId)
    .eq("org_id", admin.value.orgId)
    .single();

  if (versionError || !version) {
    return Response.json({ error: "Template version not found." }, { status: 404 });
  }

  const decision = decideTemplateVersionPublish(version.status);
  if (!decision.ok) {
    return Response.json({ error: decision.reason }, { status: 409 });
  }

  if (!decision.alreadyPublished) {
    const publishedAt = new Date().toISOString();
    const { error: familyError } = await supabase
      .from("template_families")
      .update({ status: "active", updated_at: publishedAt })
      .eq("id", version.family_id)
      .eq("org_id", admin.value.orgId);
    if (familyError) {
      return Response.json({ error: "Failed to activate template family." }, { status: 500 });
    }

    const { error: publishError } = await supabase
      .from("template_versions")
      .update({ status: "published", published_at: publishedAt })
      .eq("id", version.id)
      .eq("org_id", admin.value.orgId);
    if (publishError) {
      return Response.json({ error: "Failed to publish template version." }, { status: 500 });
    }
  }

  return Response.json({
    templateVersionId: version.id,
    templateFamilyId: version.family_id,
    status: "published",
    alreadyPublished: decision.alreadyPublished,
  });
}
