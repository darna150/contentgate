import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Export is gated server-side: only approved content can leave the system,
// no matter what the UI shows or what URL is requested.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // RLS scopes the read to the caller's org.
  const { data: content } = await supabase
    .from("generated_content")
    .select("id, org_id, title, body, status, target_language")
    .eq("id", id)
    .single();
  if (!content) return new Response("Not found", { status: 404 });
  if (content.status !== "approved") {
    return new Response("Only approved content can be exported.", {
      status: 403,
    });
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await createAdminClient().from("audit_log").insert({
      org_id: content.org_id,
      actor_id: user.id,
      action: "content.exported",
      entity_type: "generated_content",
      entity_id: content.id,
      detail: { format: "md" },
    });
  }

  const filename = `${content.title.replace(/[^\w\d-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "content"}.md`;
  const file = `# ${content.title}\n\n${content.body}\n`;
  return new Response(file, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
