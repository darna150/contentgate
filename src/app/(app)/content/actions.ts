"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { flattenFields } from "@/lib/templates";
import { templateFieldIssues, type FieldLimits } from "@/lib/template-fields";
import { validateTemplateContentFit } from "@/lib/template-content-fit";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import {
  formatTemplatePlatformFitIssues,
  resolveTemplatePlatformVariantLayout,
  templatePlatformFieldFitIssues,
  type TemplatePlatformResolvedTextLayout,
} from "@/lib/template-platform/fit";
import {
  BACKGROUND_CHOICE_FIELD,
  getTemplateBundleVariantFieldLimits,
  getTemplateBundleVariantFields,
} from "@/lib/template-platform/runtime";
import { createTemplateBundleAssetUrlMap } from "@/lib/template-platform/storage-urls";
import {
  canReviewContent,
  canSubmitContent,
  type ContentStatus,
} from "@/lib/content-governance";

type FitStorageClient = Awaited<ReturnType<typeof createClient>>;

type ActionResult =
  | {
      ok: true;
      status?: string;
      savedAt?: string;
      manuallyEdited?: boolean;
    }
  | { error: string };

type DraftFitResult =
  | {
      ok: true;
      overflowFields: string[];
      message?: string;
      textLayoutByField?: Record<string, TemplatePlatformResolvedTextLayout>;
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

function revalidateContentSurfaces(id: string) {
  revalidatePath(`/content/${id}`);
  revalidatePath(`/studio/${id}`);
  revalidatePath("/content");
  revalidatePath("/approvals");
}

async function validateStoredTemplateFields(
  content: {
    structured_fields: unknown;
    prompt_context?: unknown;
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
    template_versions?:
      | { manifest: TemplateBundleManifest }
      | { manifest: TemplateBundleManifest }[]
      | null;
    template_variants?:
      | { variant_key: string }
      | { variant_key: string }[]
      | null;
  },
  supabase: FitStorageClient
): Promise<string | null> {
  const template = Array.isArray(content.product_templates)
    ? content.product_templates[0]
    : content.product_templates;
  const version = Array.isArray(content.template_versions)
    ? content.template_versions[0]
    : content.template_versions;
  const variant = Array.isArray(content.template_variants)
    ? content.template_variants[0]
    : content.template_variants;
  if (!template && version?.manifest && variant?.variant_key) {
    const platformFields = getTemplateBundleVariantFields(version.manifest, variant.variant_key);
    const order = platformFields.map((field) => field.key);
    const requiredFields = platformFields
      .filter((field) => field.required !== false)
      .map((field) => field.key);
    const limits = getTemplateBundleVariantFieldLimits(version.manifest, variant.variant_key);
    const fields = (content.structured_fields ?? {}) as Record<string, unknown>;
    const issues = templateFieldIssues(fields, order, limits, requiredFields);
    const firstIssue = Object.entries(issues)[0];
    if (firstIssue) {
      return `${firstIssue[0]}: ${firstIssue[1].map((issue) => issue.message).join(", ")}`;
    }
    const assetUrlByPath = Object.fromEntries(
      await createTemplateBundleAssetUrlMap(supabase, [version.manifest])
    );
    const geometryIssues = await templatePlatformFieldFitIssues({
      manifest: version.manifest,
      variantKey: variant.variant_key,
      fields,
      assetUrlByPath,
    });
    return formatTemplatePlatformFitIssues(geometryIssues)[0] ?? null;
  }
  if (!template) return "Template configuration was not found.";
  const order = (template.editable_fields ?? []) as string[];
  const fields = (content.structured_fields ?? {}) as Record<string, unknown>;
  return validateTemplateContentFit({
    layoutKey: template.layout_key,
    category: template.category,
    editableFields: order,
    fieldLimits: (template.field_limits ?? {}) as FieldLimits,
    lockedFields: (template.locked_fields ?? []) as string[],
    definition: template.template_definition,
    status: template.status,
    fields,
    promptContext: content.prompt_context,
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

  revalidateContentSurfaces(id);
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
      "structured_fields, prompt_context, product_templates(layout_key, category, editable_fields, field_limits, locked_fields, template_definition, status), template_versions(manifest), template_variants(variant_key)"
    )
    .eq("id", id)
    .single();
  const template = Array.isArray(content?.product_templates)
    ? content.product_templates[0]
    : content?.product_templates;
  const version = Array.isArray(content?.template_versions)
    ? content.template_versions[0]
    : content?.template_versions;
  const variant = Array.isArray(content?.template_variants)
    ? content.template_variants[0]
    : content?.template_variants;
  if (!template && (!version?.manifest || !variant?.variant_key)) {
    return { error: "Template configuration was not found." };
  }

  const order = template
    ? ((template.editable_fields ?? []) as string[])
    : getTemplateBundleVariantFields(
        version!.manifest as TemplateBundleManifest,
        variant!.variant_key
      ).map((field) => field.key);
  const requiredFields = template
    ? order
    : getTemplateBundleVariantFields(
        version!.manifest as TemplateBundleManifest,
        variant!.variant_key
      )
        .filter((field) => field.required !== false)
        .map((field) => field.key);
  const cleaned = Object.fromEntries(
    order.map((key) => [key, String(fields[key] ?? "")])
  );
  if (!template && typeof fields[BACKGROUND_CHOICE_FIELD] === "string") {
    cleaned[BACKGROUND_CHOICE_FIELD] = fields[BACKGROUND_CHOICE_FIELD];
  }
  const promptContext =
    content?.prompt_context && typeof content.prompt_context === "object"
      ? (content.prompt_context as Record<string, unknown>)
      : {};
  const validationError = template
    ? await validateTemplateContentFit({
        layoutKey: template.layout_key,
        category: template.category,
        editableFields: order,
        fieldLimits: (template.field_limits ?? {}) as FieldLimits,
        lockedFields: (template.locked_fields ?? []) as string[],
        definition: template.template_definition,
        status: template.status,
        fields: cleaned,
        promptContext,
      })
    : (() => {
        const limits = getTemplateBundleVariantFieldLimits(
          version!.manifest as TemplateBundleManifest,
          variant!.variant_key
        );
        const issues = templateFieldIssues(cleaned, order, limits, requiredFields);
        const firstIssue = Object.entries(issues)[0];
        return firstIssue
          ? `${firstIssue[0]}: ${firstIssue[1].map((issue) => issue.message).join(", ")}`
          : null;
      })();
  if (validationError) return { error: validationError };
  if (!template) {
    const assetUrlByPath = Object.fromEntries(
      await createTemplateBundleAssetUrlMap(ctx.supabase, [
        version!.manifest as TemplateBundleManifest,
      ])
    );
    const geometryIssues = await templatePlatformFieldFitIssues({
      manifest: version!.manifest as TemplateBundleManifest,
      variantKey: variant!.variant_key,
      fields: cleaned,
      assetUrlByPath,
    });
    const firstGeometryIssue = formatTemplatePlatformFitIssues(geometryIssues)[0];
    if (firstGeometryIssue) return { error: firstGeometryIssue };
  }

  const body = flattenFields(cleaned, order);
  if (!body) return { error: "Content cannot be empty." };

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

  revalidateContentSurfaces(id);
  return {
    ok: true,
    status: row.status,
    savedAt,
    manuallyEdited: manuallyEditedFields.length > 0,
  };
}

export async function checkDraftStructuredFieldsFit(
  id: string,
  fields: Record<string, string>
): Promise<DraftFitResult> {
  const ctx = await requireUser();
  if (!ctx) return { error: "Your session expired — sign in again." };

  const { data: content } = await ctx.supabase
    .from("generated_content")
    .select(
      "structured_fields, prompt_context, product_templates(layout_key, category, editable_fields, field_limits, locked_fields, template_definition, status), template_versions(manifest), template_variants(variant_key)"
    )
    .eq("id", id)
    .single();
  if (!content) return { error: "Content not found." };

  const template = Array.isArray(content.product_templates)
    ? content.product_templates[0]
    : content.product_templates;
  const version = Array.isArray(content.template_versions)
    ? content.template_versions[0]
    : content.template_versions;
  const variant = Array.isArray(content.template_variants)
    ? content.template_variants[0]
    : content.template_variants;

  if (!template && version?.manifest && variant?.variant_key) {
    const platformFields = getTemplateBundleVariantFields(version.manifest, variant.variant_key);
    const order = platformFields.map((field) => field.key);
    const requiredFields = platformFields
      .filter((field) => field.required !== false)
      .map((field) => field.key);
    const limits = getTemplateBundleVariantFieldLimits(version.manifest, variant.variant_key);
    const cleaned = Object.fromEntries(
      order.map((key) => [key, String(fields[key] ?? "")])
    );
    const configuredIssues = templateFieldIssues(cleaned, order, limits, requiredFields);
    const assetUrlByPath = Object.fromEntries(
      await createTemplateBundleAssetUrlMap(ctx.supabase, [version.manifest])
    );
    const [geometryIssues, textLayoutByField] = await Promise.all([
      templatePlatformFieldFitIssues({
        manifest: version.manifest,
        variantKey: variant.variant_key,
        fields: cleaned,
        assetUrlByPath,
      }),
      resolveTemplatePlatformVariantLayout({
        manifest: version.manifest,
        variantKey: variant.variant_key,
        fields: cleaned,
        assetUrlByPath,
      }),
    ]);
    return {
      ok: true,
      overflowFields: [
        ...new Set([
          ...Object.keys(configuredIssues),
          ...Object.keys(geometryIssues),
        ]),
      ],
      message: formatTemplatePlatformFitIssues(geometryIssues)[0],
      textLayoutByField,
    };
  }

  if (!template) return { error: "Template configuration was not found." };
  const order = (template.editable_fields ?? []) as string[];
  const cleaned = Object.fromEntries(
    order.map((key) => [key, String(fields[key] ?? "")])
  );
  const promptContext =
    content.prompt_context && typeof content.prompt_context === "object"
      ? (content.prompt_context as Record<string, unknown>)
      : {};
  const validationError = await validateTemplateContentFit({
    layoutKey: template.layout_key,
    category: template.category,
    editableFields: order,
    fieldLimits: (template.field_limits ?? {}) as FieldLimits,
    lockedFields: (template.locked_fields ?? []) as string[],
    definition: template.template_definition,
    status: template.status,
    fields: cleaned,
    promptContext,
  });
  return {
    ok: true,
    overflowFields: validationError ? ["layout"] : [],
    message: validationError ?? undefined,
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
      "status, structured_fields, prompt_context, product_templates(layout_key, category, editable_fields, field_limits, locked_fields, template_definition, status), template_versions(manifest), template_variants(variant_key)"
    )
    .eq("id", id)
    .single();
  if (!row) {
    return { error: "Content not found." };
  }
  if (row.status !== "in_review") {
    return { error: "Only content in review can be approved." };
  }
  const validationError = await validateStoredTemplateFields(row, ctx.supabase);
  if (validationError) {
    return { error: `Content no longer fits its template: ${validationError}` };
  }

  const { error } = await ctx.supabase.rpc("transition_generated_content", {
    p_content_id: id,
    p_action: "approve",
    p_note: null,
  });
  if (error) return { error: `Could not approve: ${error.message}` };

  revalidateContentSurfaces(id);
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

  revalidateContentSurfaces(id);
  return { ok: true };
}

export async function submitForReview(id: string): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { error: "Your session expired — sign in again." };
  const { data: current } = await ctx.supabase
    .from("generated_content")
    .select(
      "created_by, status, structured_fields, prompt_context, product_templates(layout_key, category, editable_fields, field_limits, locked_fields, template_definition, status), template_versions(manifest), template_variants(variant_key)"
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
  const validationError = await validateStoredTemplateFields(current, ctx.supabase);
  if (validationError) {
    return { error: `Content does not fit its template: ${validationError}` };
  }

  const { error } = await ctx.supabase.rpc("transition_generated_content", {
    p_content_id: id,
    p_action: "submit",
    p_note: null,
  });
  if (error) return { error: `Could not submit: ${error.message}` };

  revalidateContentSurfaces(id);
  return { ok: true };
}
