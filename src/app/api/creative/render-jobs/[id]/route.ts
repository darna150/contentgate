import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

  const { data: job } = await supabase
    .from("render_jobs")
    .select("id, status, output_storage_path")
    .eq("id", id)
    .single();

  if (!job) return new Response("Not found", { status: 404 });
  if (job.status !== "completed" || !job.output_storage_path) {
    return new Response("Stored render output is unavailable.", { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("rendered-assets")
    .createSignedUrl(job.output_storage_path, 60);
  if (error || !data?.signedUrl) {
    return new Response("Could not create signed render URL.", { status: 500 });
  }

  redirect(data.signedUrl);
}
