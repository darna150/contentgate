"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flattenFields } from "@/lib/templates";

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

export async function updateStructuredFields(
  id: string,
  fields: Record<string, string>,
  order: string[]
): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { error: "Your session expired — sign in again." };

  const cleaned: Record<string, string> = {};
  for (const k of order) cleaned[k] = (fields[k] ?? "").trim();
  const body = flattenFields(cleaned, order);
  if (!body) return { error: "Content cannot be empty." };

  // Updating body triggers revoke_approval_on_edit (approved → draft).
  const { data: row, error } = await ctx.supabase
    .from("generated_content")
    .update({ structured_fields: cleaned, body, updated_at: new Date().toISOString() })
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

export async function approveContent(id: string): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { error: "Your session expired — sign in again." };
  if (ctx.profile.role !== "admin" && ctx.profile.role !== "approver") {
    return { error: "Only approvers can approve content." };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Approvals are not configured on this environment." };
  }

  // Service-role client bypasses RLS, so org + state checks live here.
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("generated_content")
    .select("org_id, status")
    .eq("id", id)
    .single();
  if (!row || row.org_id !== ctx.profile.org_id) {
    return { error: "Content not found." };
  }
  if (row.status !== "in_review") {
    return { error: "Only content in review can be approved." };
  }

  const { error } = await admin
    .from("generated_content")
    .update({
      status: "approved",
      approved_by: ctx.user.id,
      approved_at: new Date().toISOString(),
      rejection_note: null,
    })
    .eq("id", id);
  if (error) return { error: `Could not approve: ${error.message}` };

  await writeAudit({
    org_id: ctx.profile.org_id,
    actor_id: ctx.user.id,
    action: "content.approved",
    entity_id: id,
  });

  revalidatePath(`/content/${id}`);
  revalidatePath("/content");
  revalidatePath("/approvals");
  return { ok: true };
}

export async function rejectContent(
  id: string,
  note: string
): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { error: "Your session expired — sign in again." };
  if (ctx.profile.role !== "admin" && ctx.profile.role !== "approver") {
    return { error: "Only approvers can reject content." };
  }
  if (!note.trim()) {
    return { error: "Add a note so the author knows what to change." };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Approvals are not configured on this environment." };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("generated_content")
    .select("org_id, status")
    .eq("id", id)
    .single();
  if (!row || row.org_id !== ctx.profile.org_id) {
    return { error: "Content not found." };
  }
  if (row.status !== "in_review") {
    return { error: "Only content in review can be rejected." };
  }

  const { error } = await admin
    .from("generated_content")
    .update({ status: "rejected", rejection_note: note.trim() })
    .eq("id", id);
  if (error) return { error: `Could not reject: ${error.message}` };

  await writeAudit({
    org_id: ctx.profile.org_id,
    actor_id: ctx.user.id,
    action: "content.rejected",
    entity_id: id,
    detail: { note: note.trim() },
  });

  revalidatePath(`/content/${id}`);
  revalidatePath("/content");
  revalidatePath("/approvals");
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
