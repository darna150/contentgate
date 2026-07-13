"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { flattenFields } from "@/lib/templates";
import {
  templateFieldIssues,
  type FieldLimits,
} from "@/lib/template-fields";
import { resolveEffectiveFieldLimits } from "@/lib/template-specs";
import { isTemplateContractReady } from "@/lib/template-contract";
import {
  canReviewContent,
  canSubmitContent,
  type ContentStatus,
} from "@/lib/content-governance";

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
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile) return null;
  return { supabase, user, profile };
}

function validateStoredTemplateFields(content: {
  structured_fields: unknown;
  product_templates:
    | {
        layout_key: string;
        category: string;
        editable_fields: unknown;
        field_limits: unknown;
        locked_fields: unknown;
        template_definition: unknown;
        status: string;
      }
    | {
        layout_key: string;
        category: string;
        editable_fields: unknown;
        field_limits: unknown;
        locked_fields: unknown;
        template_definition: unknown;
        status: string;
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
  if (
    !isTemplateContractReady({
      layoutKey: template.layout_key,
      category: template.category,
      editableFields: order,
      fieldLimits: limits,
      lockedFields: (template.locked_fields ?? []) as string[],
      definition: template.template_definition,
      status: template.status,
    })
  ) {
    return "Template configuration does not meet the active engine contract.";
  }
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
      "structured_fields, prompt_context, product_templates(layout_key, category, editable_fields, field_limits, locked_fields, template_definition, status)"
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
  if (
    !isTemplateContractReady({
      layoutKey: template.layout_key,
      category: template.category,
      editableFields: order,
      fieldLimits: limits,
      lockedFields: (template.locked_fields ?? []) as string[],
      definition: template.template_definition,
      status: template.status,
    })
  ) {
    return { error: "Template configuration is not ready for editing." };
  }
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
  if (!canReviewContent(ctx.profile.role)) {
    return { error: "Only approvers can approve content." };
  }

  const { data: row } = await ctx.supabase
    .from("generated_content")
    .select(
      "status, structured_fields, product_templates(layout_key, category, editable_fields, field_limits, locked_fields, template_definition, status)"
    )
    .eq("id", id)
    .single();
  if (!row) {
    return { error: "Content not found." };
  }
  if (row.status !== "in_review") {
    return { error: "Only content in review can be approved." };
  }
  const validationError = validateStoredTemplateFields(row);
  if (validationError) {
    return { error: `Content no longer fits its template: ${validationError}` };
  }

  const { error } = await ctx.supabase.rpc("transition_generated_content", {
    p_content_id: id,
    p_action: "approve",
    p_note: null,
  });
  if (error) return { error: `Could not approve: ${error.message}` };

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
  if (!canReviewContent(ctx.profile.role)) {
    return { error: "Only approvers can reject content." };
  }
  if (!note.trim()) {
    return { error: "Add a note so the author knows what to change." };
  }
  const { error } = await ctx.supabase.rpc("transition_generated_content", {
    p_content_id: id,
    p_action: "reject",
    p_note: note.trim(),
  });
  if (error) return { error: `Could not reject: ${error.message}` };

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
    .select(
      "created_by, status, structured_fields, product_templates(layout_key, category, editable_fields, field_limits, locked_fields, template_definition, status)"
    )
    .eq("id", id)
    .single();
  if (!current) {
    return { error: "Content not found." };
  }
  if (
    !canSubmitContent({
      role: ctx.profile.role,
      userId: ctx.user.id,
      authorId: current.created_by,
      status: current.status as ContentStatus,
    })
  ) {
    if (current.status !== "draft" && current.status !== "rejected") {
      return { error: "Only drafts can be submitted for review." };
    }
    return { error: "Only the author or an admin can submit this content." };
  }
  const validationError = validateStoredTemplateFields(current);
  if (validationError) {
    return { error: `Content does not fit its template: ${validationError}` };
  }

  const { error } = await ctx.supabase.rpc("transition_generated_content", {
    p_content_id: id,
    p_action: "submit",
    p_note: null,
  });
  if (error) return { error: `Could not submit: ${error.message}` };

  revalidatePath(`/content/${id}`);
  revalidatePath("/content");
  revalidatePath("/approvals");
  return { ok: true };
}
