import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusPill } from "@/components/status-pill";
import { ContentEditor } from "./editor";
import { StructuredReview } from "./structured-review";
import { ApprovalActions } from "./approval-actions";
import { ExportButtons } from "./export-buttons";
import type { Evidence } from "@/lib/templates";
import { resolveEffectiveFieldLimits } from "@/lib/template-specs";
import { mergeFieldLimits, type FieldLimits } from "@/lib/template-fields";
import { getPublishedTemplateFrameFieldLimits } from "@/lib/published-template-package";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import {
  getTemplateBundleVariantFieldLimits,
  getTemplateBundleVariantFields,
  resolveTemplateBundleRuntimeVariant,
} from "@/lib/template-platform/runtime";
import { renderTemplateBundleVariant } from "@/lib/template-platform/render";
import {
  TEMPLATE_OUTPUT_SIZES,
  type TemplateSizeKey,
} from "@/lib/template-contract";
import {
  ContentHistory,
  type ContentHistoryEvent,
  type ContentRevisionSummary,
} from "./content-history";
import { canEditContent, type ContentStatus } from "@/lib/content-governance";

function isSizeKey(value: unknown): value is TemplateSizeKey {
  return typeof value === "string" && value in TEMPLATE_OUTPUT_SIZES;
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="#1E6B43" strokeWidth="1.4" />
      <path d="M5.2 8.2l2 2 3.6-4" stroke="#1E6B43" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let viewerIsApprover = false;
  if (user) {
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    viewerIsApprover = me?.role === "admin" || me?.role === "approver";
  }

  const { data: content } = await supabase
    .from("generated_content")
    .select(
      "id, title, body, status, target_language, audience, source_document_ids, rejection_note, created_at, approved_at, created_by, product_id, product_template_id, template_version_id, template_variant_id, structured_fields, prompt_context, citations, current_revision_number, approved_revision_number, products(name), product_templates(layout_key, variant, category, editable_fields, field_limits, template_definition), template_versions(id, version_label, manifest), template_variants(id, variant_key, label), creator:profiles!generated_content_created_by_fkey(full_name), approver:profiles!generated_content_approved_by_fkey(full_name)"
    )
    .eq("id", id)
    .single();
  if (!content) notFound();

  const [{ data: historyEvents }, { data: revisionRows }] = await Promise.all([
    supabase
      .from("generated_content_events")
      .select("id, actor_name, revision_number, event_type, detail, created_at")
      .eq("content_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(30),
    supabase
      .from("generated_content_revisions")
      .select("id, revision_number, actor_name, change_kind, created_at")
      .eq("content_id", id)
      .order("revision_number", { ascending: false })
      .limit(10),
  ]);

  const { data: sourceDocs } = await supabase
    .from("documents")
    .select("id, title")
    .in("id", content.source_document_ids ?? []);

  const product = Array.isArray(content.products) ? content.products[0] : content.products;
  const ptemplate = Array.isArray(content.product_templates)
    ? content.product_templates[0]
    : content.product_templates;
  const platformVersion = Array.isArray(content.template_versions)
    ? content.template_versions[0]
    : content.template_versions;
  const platformVariant = Array.isArray(content.template_variants)
    ? content.template_variants[0]
    : content.template_variants;
  const creator = Array.isArray(content.creator) ? content.creator[0] : content.creator;
  const approver = Array.isArray(content.approver) ? content.approver[0] : content.approver;

  const platformManifest = platformVersion?.manifest as TemplateBundleManifest | undefined;
  const platformVariantKey =
    typeof platformVariant?.variant_key === "string"
      ? platformVariant.variant_key
      : null;
  const platformRuntime =
    platformManifest && platformVariantKey
      ? resolveTemplateBundleRuntimeVariant(platformManifest, platformVariantKey)
      : null;
  const isLegacyStructured = !!content.product_id && !!ptemplate;
  const isPlatformStructured = !!content.product_id && !!platformRuntime && !!platformManifest && !!platformVariantKey;
  const isStructured = isLegacyStructured || isPlatformStructured;
  const promptContext =
    content.prompt_context && typeof content.prompt_context === "object"
      ? (content.prompt_context as Record<string, unknown>)
      : null;
  const outputSize = isSizeKey(promptContext?.output_size)
    ? promptContext.output_size
    : null;
  const order: string[] = isPlatformStructured
    ? getTemplateBundleVariantFields(platformManifest, platformVariantKey).map((field) => field.key)
    : (ptemplate?.editable_fields as string[]) ?? [];
  const structuredFields = (content.structured_fields ?? {}) as Record<string, string>;
  const evidence = (content.citations ?? []) as Evidence[];
  const viewerCanEdit = !!user && canEditContent({
    userId: user.id,
    authorId: content.created_by,
    status: content.status as ContentStatus,
  });
  const baseLimits = isPlatformStructured
    ? getTemplateBundleVariantFieldLimits(platformManifest, platformVariantKey)
    : resolveEffectiveFieldLimits(
        ptemplate?.layout_key,
        (ptemplate?.field_limits ?? {}) as FieldLimits
      );
  const frameLimits =
    !isPlatformStructured && outputSize && ptemplate?.layout_key
      ? getPublishedTemplateFrameFieldLimits(
          ptemplate.layout_key,
          outputSize,
          ptemplate.template_definition
        )
      : null;
  const effectiveLimits = mergeFieldLimits(baseLimits, frameLimits);
  const studioParams =
    isLegacyStructured && content.product_id && content.product_template_id
      ? new URLSearchParams({
          product: content.product_id,
          template: content.product_template_id,
          content: content.id,
        })
      : null;
  const platformAssignmentId =
    typeof (content.prompt_context as { platform_assignment_id?: unknown } | null)
      ?.platform_assignment_id === "string"
      ? ((content.prompt_context as { platform_assignment_id: string })
          .platform_assignment_id)
      : null;
  const platformStudioParams =
    isPlatformStructured && content.product_id && platformAssignmentId
      ? new URLSearchParams({
          product: content.product_id,
          template: `platform:${platformAssignmentId}`,
          content: content.id,
        })
      : null;
  if (studioParams && outputSize) studioParams.set("size", outputSize);
  if (platformStudioParams && outputSize) platformStudioParams.set("size", outputSize);

  const subtitle = isPlatformStructured
    ? `${product?.name ?? "Product"} · ${platformVersion?.version_label ?? "Platform template"} · ${content.target_language}`
    : isLegacyStructured
    ? `${product?.name ?? "Product"} · ${ptemplate?.variant ?? ""} · ${content.target_language}`
    : `${content.target_language}${content.audience ? ` · for ${content.audience}` : ""}`;
  const platformPreview = isPlatformStructured
    ? renderTemplateBundleVariant({
        manifest: platformManifest,
        variantKey: platformVariantKey,
        fields: structuredFields,
      })
    : null;
  const platformPreviewScale = platformPreview
    ? Math.min(760 / platformPreview.width, 1)
    : 1;

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
      <div className="flex items-end gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Link href="/content" className="text-[13px] font-semibold text-brand hover:underline">
            ← Content
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="truncate font-serif text-[28px] font-semibold leading-tight">
              {content.title}
            </h1>
            <StatusPill status={content.status} />
          </div>
          <p className="text-[13.5px] text-ink-muted">
            {subtitle} · created{" "}
            {new Date(content.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
            {creator?.full_name ? ` by ${creator.full_name}` : ""}
          </p>
        </div>
      </div>

      {content.status === "rejected" && content.rejection_note && (
        <div className="flex flex-col gap-1 rounded-[10px] border border-reject-border bg-reject-tint px-[18px] py-[14px]">
          <span className="text-[13.5px] font-bold text-reject">Changes requested</span>
          <span className="text-[13px] text-ink-muted">{content.rejection_note}</span>
        </div>
      )}
      {content.status === "approved" && (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-approve-border bg-approve-tint px-[18px] py-[14px]">
          <CheckIcon />
          <span className="text-[13.5px] text-ink-muted">
            <span className="font-bold text-approve">Approved</span>
            {approver?.full_name ? ` by ${approver.full_name}` : ""}
            {content.approved_at
              ? ` on ${new Date(content.approved_at).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
              : ""}
            . Editing it moves it back to draft.
          </span>
        </div>
      )}

      <div className="grid grid-cols-[1.6fr_1fr] items-start gap-5">
        <div className="min-w-0">
          {platformPreview && (
            <div className="mb-5 flex flex-col gap-3 rounded-card border border-edge bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-bold">Template preview</h2>
                <span className="rounded-[5px] bg-brand-tint px-[7px] py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand">
                  Platform v1
                </span>
              </div>
              <div className="overflow-auto rounded-[10px] border border-edge bg-page p-4">
                <div
                  className="mx-auto overflow-hidden"
                  style={{
                    width: platformPreview.width * platformPreviewScale,
                    height: platformPreview.height * platformPreviewScale,
                  }}
                >
                  <div
                    style={{
                      width: platformPreview.width,
                      height: platformPreview.height,
                      transform: `scale(${Math.min(760 / platformPreview.width, 1)})`,
                      transformOrigin: "top left",
                    }}
                  >
                    {platformPreview.element}
                  </div>
                </div>
              </div>
            </div>
          )}
          {isStructured ? (
            <StructuredReview
              id={content.id}
              status={content.status}
              initialFields={structuredFields}
              order={order}
              evidence={evidence}
              limits={effectiveLimits}
              editable={viewerCanEdit}
            />
          ) : (
            <div className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-6">
              <h2 className="text-[15px] font-bold">Content</h2>
              <ContentEditor
                id={content.id}
                initialBody={content.body}
                status={content.status}
                editable={viewerCanEdit}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {content.status === "in_review" && viewerIsApprover && <ApprovalActions id={content.id} />}
          {(studioParams || platformStudioParams) && (
            <Link
              href={`/studio?${(studioParams ?? platformStudioParams)?.toString() ?? ""}`}
              className="rounded-control border border-brand bg-brand-tint px-4 py-2.5 text-center text-[13.5px] font-semibold text-brand"
            >
              Preview in Studio
            </Link>
          )}
          {content.status === "approved" && (
            <ExportButtons
              id={content.id}
              body={content.body}
              productId={content.product_id}
              templateId={content.product_template_id}
              platformAssignmentId={platformAssignmentId}
              outputSize={outputSize}
            />
          )}
          <ContentHistory
            currentRevision={content.current_revision_number}
            approvedRevision={content.approved_revision_number}
            events={(historyEvents ?? []) as ContentHistoryEvent[]}
            revisions={(revisionRows ?? []) as ContentRevisionSummary[]}
          />
          <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-[22px]">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold">Generated from</h2>
              <span className="rounded-[5px] bg-brand-tint px-[7px] py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand">
                Approved sources only
              </span>
            </div>
            {isStructured && product && (
              <Link
                href={`/products/${content.product_id}`}
                className="flex items-center gap-2 text-[13px] font-semibold text-ink transition-colors hover:text-brand"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-brand-dark text-[11px] font-bold text-white">
                  {product.name[0]}
                </span>
                {product.name}
              </Link>
            )}
            {(sourceDocs ?? []).length === 0 ? (
              <p className="text-[13px] text-ink-faint">No source documents linked.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(sourceDocs ?? []).map((doc) => (
                  <li key={doc.id}>
                    <Link
                      href={`/knowledge/${doc.id}`}
                      className="flex items-center gap-2.5 text-[13px] font-medium text-ink transition-colors hover:text-brand"
                    >
                      <CheckIcon />
                      <span className="min-w-0 truncate">{doc.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="border-t border-edge pt-3 text-xs leading-relaxed text-ink-faint">
              Every field is grounded in approved sources. Each claim shows its
              evidence inline for the reviewer to verify.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
