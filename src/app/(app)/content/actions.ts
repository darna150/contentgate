"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flattenFields } from "@/lib/templates";
import {
  templateFieldIssues,
  type FieldLimits,
} from "@/lib/template-fields";
import { resolveEffectiveFieldLimits } from "@/lib/template-specs";

type ActionResult =
  | {
      ok: true;
      status?: string;
      savedAt?: string;
      manuallyEdited?: boolean;
    }
  | { error: string };

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

function validateStoredTemplateFields(content: {
  structured_fields: unknown;
  product_templates:
    | {
        layout_key: string;
        editable_fields: unknown;
        field_limits: unknown;
      }
    | {
        layout_key: string;
        editable_fields: unknown;
        field_limits: unknown;
      }[]
    | null;
}): string | null {
  const template = Array.isArray(content.product_templates)
    ? content.product_templates[0]
    : content.product_templates;
  if (!template) return "Template configuration was not found.";
  const order = (template.editable_fields ?? []) as string[];
  const fields = (content.structured_fields ?? {}) as Record<string, unknown>;
  const limits = resolveEffectiveFieldLimits(
    template.layout_key,
    (template.field_limits ?? {}) as FieldLimits
  );
  const issues = templateFieldIssues(fields, order, limits);
  const firstIssue = order.find((key) => issues[key]?.length);
  return firstIssue
    ? `${firstIssue.replace(/_/g, " ")}: ${issues[firstIssue][0].message}`
    : null;
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
  fields: Record<string, string>
): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { error: "Your session expired — sign in again." };

  const { data: content } = await ctx.supabase
    .from("generated_content")
    .select(
      "structured_fields, prompt_context, product_templates(layout_key, editable_fields, field_limits)"
    )
    .eq("id", id)
    .single();
  const template = Array.isArray(content?.product_templates)
    ? content.product_templates[0]
    : content?.product_templates;
  if (!template) return { error: "Template configuration was not found." };

  const order = (template.editable_fields ?? []) as string[];
  const limits = resolveEffectiveFieldLimits(
    template.layout_key,
    (template.field_limits ?? {}) as FieldLimits
  );
  const cleaned = Object.fromEntries(
    order.map((key) => [key, String(fields[key] ?? "")])
  );
  const issues = templateFieldIssues(cleaned, order, limits);
  const firstIssue = order.find((key) => issues[key]?.length);
  if (firstIssue) {
    return {
      error: `${firstIssue.replace(/_/g, " ")}: ${issues[firstIssue][0].message}`,
    };
  }
  const body = flattenFields(cleaned, order);
  if (!body) return { error: "Content cannot be empty." };

  const promptContext =
    content?.prompt_context && typeof content.prompt_context === "object"
      ? (content.prompt_context as Record<string, unknown>)
      : {};
  const generatedFields =
    promptContext.generated_fields &&
    typeof promptContext.generated_fields === "object"
      ? (promptContext.generated_fields as Record<string, string>)
      : ((content?.structured_fields ?? {}) as Record<string, string>);
  const manuallyEditedFields = order.filter(
    (key) => cleaned[key] !== (generatedFields[key] ?? "")
  );
  const savedAt = new Date().toISOString();

  // Updating body triggers revoke_approval_on_edit (approved → draft).
  const { data: row, error } = await ctx.supabase
    .from("generated_content")
    .update({
      structured_fields: cleaned,
      body,
      prompt_context: {
        ...promptContext,
        generated_fields: generatedFields,
        manually_edited_fields: manuallyEditedFields,
        compliance_state:
          manuallyEditedFields.length > 0 ? "needs_review" : "generated",
        last_manual_edit_at: manuallyEditedFields.length > 0 ? savedAt : null,
      },
      updated_at: savedAt,
    })
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
    detail: {
      status_after_edit: row.status,
      manually_edited_fields: manuallyEditedFields,
    },
  });

  revalidatePath(`/content/${id}`);
  revalidatePath("/content");
  return {
    ok: true,
    status: row.status,
    savedAt,
    manuallyEdited: manuallyEditedFields.length > 0,
  };
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
    .select(
      "org_id, status, structured_fields, product_templates(layout_key, editable_fields, field_limits)"
    )
    .eq("id", id)
    .single();
  if (!row || row.org_id !== ctx.profile.org_id) {
    return { error: "Content not found." };
  }
  if (row.status !== "in_review") {
    return { error: "Only content in review can be approved." };
  }
  const validationError = validateStoredTemplateFields(row);
  if (validationError) {
    return { error: `Content no longer fits its template: ${validationError}` };
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
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Review submission is not configured on this environment." };
  }

  // Status transitions are trusted server-side workflow changes. The normal
  // authenticated client may edit drafts, but cannot promote content states.
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("generated_content")
    .select(
      "org_id, created_by, status, structured_fields, product_templates(layout_key, editable_fields, field_limits)"
    )
    .eq("id", id)
    .single();
  if (!current || current.org_id !== ctx.profile.org_id) {
    return { error: "Content not found." };
  }
  if (current.created_by !== ctx.user.id && ctx.profile.role !== "admin") {
    return { error: "Only the author or an admin can submit this content." };
  }
  if (current.status !== "draft" && current.status !== "rejected") {
    return { error: "Only drafts can be submitted for review." };
  }
  const validationError = validateStoredTemplateFields(current);
  if (validationError) {
    return { error: `Content does not fit its template: ${validationError}` };
  }

  const { error } = await admin
    .from("generated_content")
    .update({
      status: "in_review",
      rejection_note: null,
      approved_by: null,
      approved_at: null,
    })
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
