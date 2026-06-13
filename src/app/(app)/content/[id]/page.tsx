import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusPill } from "@/components/status-pill";
import { ContentEditor } from "./editor";
import { StructuredReview } from "./structured-review";
import { ApprovalActions } from "./approval-actions";
import { ExportButtons } from "./export-buttons";
import type { Evidence } from "@/lib/templates";

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
      "id, title, body, status, target_language, audience, source_document_ids, rejection_note, created_at, approved_at, product_id, product_template_id, structured_fields, citations, products(name), product_templates(variant, category, editable_fields), creator:profiles!generated_content_created_by_fkey(full_name), approver:profiles!generated_content_approved_by_fkey(full_name)"
    )
    .eq("id", id)
    .single();
  if (!content) notFound();

  const { data: sourceDocs } = await supabase
    .from("documents")
    .select("id, title")
    .in("id", content.source_document_ids ?? []);

  const product = Array.isArray(content.products) ? content.products[0] : content.products;
  const ptemplate = Array.isArray(content.product_templates)
    ? content.product_templates[0]
    : content.product_templates;
  const creator = Array.isArray(content.creator) ? content.creator[0] : content.creator;
  const approver = Array.isArray(content.approver) ? content.approver[0] : content.approver;

  const isStructured = !!content.product_id && !!ptemplate;
  const order: string[] = (ptemplate?.editable_fields as string[]) ?? [];
  const structuredFields = (content.structured_fields ?? {}) as Record<string, string>;
  const evidence = (content.citations ?? []) as Evidence[];

  const subtitle = isStructured
    ? `${product?.name ?? "Product"} · ${ptemplate?.variant ?? ""} · ${content.target_language}`
    : `${content.target_language}${content.audience ? ` · for ${content.audience}` : ""}`;

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
          {isStructured ? (
            <StructuredReview
              id={content.id}
              productTemplateId={content.product_template_id!}
              language={content.target_language}
              status={content.status}
              initialFields={structuredFields}
              order={order}
              evidence={evidence}
            />
          ) : (
            <div className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-6">
              <h2 className="text-[15px] font-bold">Content</h2>
              <ContentEditor id={content.id} initialBody={content.body} status={content.status} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {content.status === "in_review" && viewerIsApprover && <ApprovalActions id={content.id} />}
          {content.status === "approved" && <ExportButtons id={content.id} body={content.body} />}
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
