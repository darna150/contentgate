import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProductWorkspace } from "@/lib/product-workspace-server";

type QueueRow = {
  id: string;
  title: string;
  target_language: string;
  audience: string | null;
  created_at: string;
  templateName: string | null;
  creatorName: string | null;
};

type Joined<T> = T | T[] | null;

function one<T>(value: Joined<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: productId } = await searchParams;
  let rows: QueueRow[] = [];
  let productName: string | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    if (productId) {
      const workspace = await getProductWorkspace(productId);
      if (!workspace) notFound();
      productName = workspace.product.name;
      rows = workspace.approvals.map((item) => ({
        id: item.id,
        title: item.title,
        target_language: item.targetLanguage,
        audience: item.audience,
        created_at: item.createdAt,
        templateName: item.templateVariant,
        creatorName: item.creatorName,
      }));
    } else {
      const supabase = await createClient();
      const { data } = await supabase
        .from("generated_content")
        .select(
          "id, title, target_language, audience, created_at, templates(name), product_templates(variant), creator:profiles!generated_content_created_by_fkey(full_name)"
        )
        .eq("status", "in_review")
        .not("product_id", "is", null)
        .order("created_at", { ascending: true });
      rows = (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        target_language: row.target_language,
        audience: row.audience,
        created_at: row.created_at,
        templateName:
          one(row.product_templates)?.variant ?? one(row.templates)?.name ?? null,
        creatorName: one(row.creator)?.full_name ?? null,
      }));
    }
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        {productId && productName && (
          <Link
            href={`/products/${productId}`}
            className="text-[13px] font-semibold text-brand hover:underline"
          >
            ← {productName}
          </Link>
        )}
        <h1 className="font-serif text-[28px] font-semibold">Approval Queue</h1>
        <p className="text-[14.5px] text-ink-muted">
          {productName
            ? `Content for ${productName} waiting for review.`
            : "Content waiting for review. Only approved content can be exported."}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-16 text-center">
          <p className="text-[15px] font-semibold">The queue is clear</p>
          <p className="max-w-md text-sm text-ink-muted">
            When someone submits content for review, it lands here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1 rounded-card border border-edge bg-surface p-3">
          {rows.map((row) => {
            return (
              <Link
                key={row.id}
                href={`/content/${row.id}`}
                className="flex items-center gap-3.5 rounded-control px-3.5 py-3 transition-colors hover:bg-page"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13.5px] font-semibold">
                    {row.title}
                  </span>
                  <span className="text-[11.5px] text-ink-faint">
                    {row.templateName ?? "Custom"} · {row.target_language}
                    {row.audience ? ` · ${row.audience}` : ""} · submitted by{" "}
                    {row.creatorName ?? "a teammate"} ·{" "}
                    {new Date(row.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </span>
                <span className="inline-flex rounded-full bg-[#FBF3E2] px-[9px] py-0.5 text-[11.5px] font-semibold text-warn">
                  In review
                </span>
                <span className="text-[13px] font-semibold text-brand">
                  Review →
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
