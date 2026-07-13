import { createClient } from "@/lib/supabase/server";
import {
  canExportContent,
  isContentExportFormat,
  type ContentExportFormat,
  type ContentStatus,
} from "@/lib/content-governance";

type ExportSurface = "api" | "content_detail" | "studio";
type ServerClient = Awaited<ReturnType<typeof createClient>>;

async function recordExport(
  supabase: ServerClient,
  contentId: string,
  format: ContentExportFormat,
  surface: ExportSurface,
  size: string | null = null
) {
  return supabase.rpc("record_generated_content_export", {
    p_content_id: contentId,
    p_format: format,
    p_size: size,
    p_surface: surface,
  });
}

// Export is gated server-side against the exact approved revision. Logging is
// part of the database transaction, so an untracked export is never returned.
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

  const { data: content } = await supabase
    .from("generated_content")
    .select(
      "id, title, body, status, current_revision_number, approved_revision_number"
    )
    .eq("id", id)
    .single();
  if (!content) return new Response("Not found", { status: 404 });
  if (
    !canExportContent({
      status: content.status as ContentStatus,
      currentRevision: content.current_revision_number,
      approvedRevision: content.approved_revision_number,
    })
  ) {
    return new Response("Only the currently approved revision can be exported.", {
      status: 403,
    });
  }

  const { error: eventError } = await recordExport(
    supabase,
    content.id,
    "md",
    "api"
  );
  if (eventError) {
    return new Response(`Could not record export: ${eventError.message}`, {
      status: 403,
    });
  }

  const filename = `${content.title
    .replace(/[^\w\d-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "content"}.md`;
  const file = `# ${content.title}\n\n${content.body}\n`;
  return new Response(file, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { format?: unknown; size?: unknown; surface?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid export request." }, { status: 400 });
  }

  if (!isContentExportFormat(body.format) || body.format === "md") {
    return Response.json({ error: "Unsupported export format." }, { status: 400 });
  }
  if (body.surface !== "studio" && body.surface !== "content_detail") {
    return Response.json({ error: "Unsupported export surface." }, { status: 400 });
  }
  const surface = body.surface;
  const size =
    typeof body.size === "string" && body.size.length <= 50 ? body.size : null;
  const { data, error } = await recordExport(
    supabase,
    id,
    body.format,
    surface,
    size
  );
  if (error) {
    return Response.json({ error: error.message }, { status: 403 });
  }

  return Response.json({ ok: true, revisionNumber: data });
}
