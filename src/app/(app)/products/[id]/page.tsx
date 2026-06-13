import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fieldLabel } from "@/lib/templates";
import { GenerateVariant } from "./generate-variant";

const CATEGORY_LABELS: Record<string, string> = {
  social: "Social",
  flyer: "Flyer",
  one_pager: "One-pager",
  email: "Email",
  presentation: "Presentation",
};

type Template = {
  id: string;
  category: string;
  variant: string;
  editable_fields: string[];
  generation_instructions: string;
  sort_order: number;
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) notFound();

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, name, description, disclaimer_text, status")
    .eq("id", id)
    .single();
  if (!product) notFound();

  const [{ data: claims }, { data: docs }, { data: templates }] = await Promise.all([
    supabase.from("product_claims").select("claim_text").eq("product_id", id).eq("status", "approved"),
    supabase.from("documents").select("id, title").eq("product_id", id),
    supabase
      .from("product_templates")
      .select("id, category, variant, editable_fields, generation_instructions, sort_order")
      .eq("product_id", id)
      .eq("status", "active")
      .order("sort_order", { ascending: true }),
  ]);

  const byCategory = new Map<string, Template[]>();
  for (const t of (templates as Template[]) ?? []) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category)!.push(t);
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <Link href="/products" className="text-[13px] font-semibold text-brand hover:underline">
          ← Products
        </Link>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-brand-dark text-[15px] font-bold text-white">
            {product.name[0]}
          </span>
          <h1 className="font-serif text-[28px] font-semibold">{product.name}</h1>
        </div>
        {product.description && (
          <p className="max-w-2xl text-[14.5px] text-ink-muted">{product.description}</p>
        )}
      </div>

      <div className="grid grid-cols-[1.55fr_1fr] items-start gap-6">
        {/* Asset types and variants */}
        <div className="flex flex-col gap-5">
          <p className="text-[13px] text-ink-muted">
            Choose an asset type and a template variant. The variant guides how
            content is written, using only this product&apos;s approved knowledge.
          </p>
          {[...byCategory.entries()].map(([category, variants]) => (
            <div
              key={category}
              className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-[22px]"
            >
              <h2 className="text-[15px] font-bold">
                {CATEGORY_LABELS[category] ?? category}
              </h2>
              <div className="flex flex-col gap-3">
                {variants.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col gap-2.5 rounded-control border border-edge bg-page p-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold">{t.variant}</span>
                      <span className="rounded-[5px] bg-brand-tint px-[7px] py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-brand">
                        {t.editable_fields.length} fields
                      </span>
                    </div>
                    <p className="text-[12px] text-ink-faint">
                      {t.editable_fields.map((f) => fieldLabel(f)).join(" · ")}
                    </p>
                    <GenerateVariant templateId={t.id} variant={t.variant} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {byCategory.size === 0 && (
            <div className="rounded-card border border-dashed border-edge-strong bg-surface px-8 py-12 text-center text-sm text-ink-muted">
              No templates configured for this product yet.
            </div>
          )}
        </div>

        {/* Approved knowledge panel */}
        <div className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-[22px]">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold">Approved knowledge</h2>
            <span className="rounded-[5px] bg-approve-tint px-[7px] py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-approve">
              Locked
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center">
              <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
                Source documents
              </span>
              <div className="flex-1" />
              <Link
                href={`/knowledge/new?product=${id}`}
                className="text-[12px] font-semibold text-brand hover:underline"
              >
                + Add
              </Link>
            </div>
            {(docs ?? []).length === 0 ? (
              <span className="text-[13px] text-ink-faint">None yet</span>
            ) : (
              (docs ?? []).map((d) => (
                <Link
                  key={d.id}
                  href={`/knowledge/${d.id}`}
                  className="text-[13px] font-medium text-ink hover:text-brand"
                >
                  {d.title}
                </Link>
              ))
            )}
          </div>

          <div className="flex flex-col gap-1.5 border-t border-edge pt-3">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
              Approved claims ({(claims ?? []).length})
            </span>
            <ul className="flex flex-col gap-1.5">
              {(claims ?? []).map((c, i) => (
                <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-ink-muted">
                  <span className="text-approve">✓</span>
                  <span>{c.claim_text}</span>
                </li>
              ))}
            </ul>
          </div>

          {product.disclaimer_text && (
            <div className="flex flex-col gap-1.5 border-t border-edge pt-3">
              <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
                Mandatory disclaimer
              </span>
              <p className="text-[12px] italic leading-snug text-ink-faint">
                {product.disclaimer_text}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
