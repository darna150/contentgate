import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
};

export default async function ProductsPage() {
  let products: ProductRow[] = [];
  let counts: Record<string, { claims: number; templates: number }> = {};

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("products")
      .select("id, name, description, status")
      .order("created_at", { ascending: true });
    products = data ?? [];

    if (products.length) {
      const ids = products.map((p) => p.id);
      const [{ data: claims }, { data: tpls }] = await Promise.all([
        supabase.from("product_claims").select("product_id").in("product_id", ids),
        supabase.from("product_templates").select("product_id").in("product_id", ids),
      ]);
      counts = Object.fromEntries(products.map((p) => [p.id, { claims: 0, templates: 0 }]));
      for (const c of claims ?? []) counts[c.product_id].claims++;
      for (const t of tpls ?? []) counts[t.product_id].templates++;
    }
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-semibold">Products</h1>
        <p className="text-[14.5px] text-ink-muted">
          Everything starts with a product. Pick one to create compliant content
          from its approved knowledge.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-16 text-center">
          <p className="text-[15px] font-semibold">No products yet</p>
          <p className="max-w-md text-sm text-ink-muted">
            A product holds its approved documents, claims, disclaimers, and
            templates. Products are set up during onboarding.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-6 transition-colors hover:border-brand"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-brand-dark text-[13px] font-bold text-white">
                  {p.name[0]}
                </span>
                <span className="text-[16px] font-bold">{p.name}</span>
              </div>
              {p.description && (
                <p className="line-clamp-3 text-[13px] leading-relaxed text-ink-muted">
                  {p.description}
                </p>
              )}
              <div className="mt-auto flex gap-4 border-t border-edge pt-3 text-[12px] text-ink-faint">
                <span>{counts[p.id]?.claims ?? 0} approved claims</span>
                <span>{counts[p.id]?.templates ?? 0} templates</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
