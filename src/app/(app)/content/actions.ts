"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { ok: true } | { error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) return null;
  return { supabase, user, profile };
}

function writeAudit(entry: {
  org_id: string;
  actor_id: string;
  action: string;
  entity_id: string;
  detail?: Record<string, unknown>;
}) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Promise.resolve();
  return createAdminClient()
    .from("audit_log")
    .insert({ ...entry, entity_type: "generated_content" })
    .then(({ error }) => {
      if (error) console.error("audit_log insert failed:", error.message);
    });
}

export async function updateContentBody(
  id: string,
  body: string
): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { error: "Your session expired — sign in again." };
  const trimmed = body.trim();
  if (!trimmed) return { error: "Content cannot be empty." };

  // The revoke_approval_on_edit trigger drops approved → draft on body change.
  const { data: row, error } = await ctx.supabase
    .from("generated_content")
    .update({ body: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, status")
    .single();
  if (error || !row) {
    return { error: `Could not save: ${error?.message ?? "not found"}` };
  }

  await writeAudit({
    org_id: ctx.profile.org_id,
    actor_id: ctx.user.id,
    action: "content.edited",
    entity_id: id,
    detail: { status_after_edit: row.status },
  });

  revalidatePath(`/content/${id}`);
  revalidatePath("/content");
  return { ok: true };
}

export async function submitForReview(id: string): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { error: "Your session expired — sign in again." };

  const { data: current } = await ctx.supabase
    .from("generated_content")
    .select("status")
    .eq("id", id)
    .single();
  if (!current) return { error: "Content not found." };
  if (current.status !== "draft" && current.status !== "rejected") {
    return { error: "Only drafts can be submitted for review." };
  }

  const { error } = await ctx.supabase
    .from("generated_content")
    .update({ status: "in_review", rejection_note: null })
    .eq("id", id);
  if (error) return { error: `Could not submit: ${error.message}` };

  await writeAudit({
    org_id: ctx.profile.org_id,
    actor_id: ctx.user.id,
    action: "content.submitted",
    entity_id: id,
  });

  revalidatePath(`/content/${id}`);
  revalidatePath("/content");
  revalidatePath("/approvals");
  return { ok: true };
}
