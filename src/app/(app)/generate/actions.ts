"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SaveDraftResult = { id: string } | { error: string };

export async function saveDraft(input: {
  title: string;
  body: string;
  templateId: string;
  documentIds: string[];
  audience?: string;
  language: string;
}): Promise<SaveDraftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired — sign in again." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "Profile not found." };

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) return { error: "Nothing to save yet." };

  const { data: row, error } = await supabase
    .from("generated_content")
    .insert({
      org_id: profile.org_id,
      created_by: user.id,
      template_id: input.templateId,
      source_document_ids: input.documentIds,
      title,
      body,
      audience: input.audience?.trim() || null,
      target_language: input.language,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !row) {
    return { error: `Could not save the draft: ${error?.message ?? "unknown error"}` };
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { error: auditError } = await createAdminClient().from("audit_log").insert({
      org_id: profile.org_id,
      actor_id: user.id,
      action: "content.created",
      entity_type: "generated_content",
      entity_id: row.id,
      detail: { title, source_documents: input.documentIds.length },
    });
    if (auditError) console.error("audit_log insert failed:", auditError.message);
  }

  revalidatePath("/dashboard");
  return { id: row.id };
}
