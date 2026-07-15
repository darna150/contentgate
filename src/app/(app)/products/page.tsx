import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { ProductStatusBadge } from "./[id]/_workspace/product-status-badge";
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
  let isAdmin = false;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      isAdmin = me?.role === "admin";
    }
    const { data } = await supabase
      .from("products")
      .select("id, name, description, status")
      .order("created_at", { ascending: true });
    products = data ?? [];

    if (products.length) {
      const ids = products.map((p) => p.id);
      const [{ data: claims }, { data: tpls }] = await Promise.all([
        supabase.from("product_claims").select("product_id").in("product_id", ids),
        supabase
          .from("product_template_assignments")
          .select("product_id")
          .in("product_id", ids)
          .eq("status", "active"),
      ]);
      counts = Object.fromEntries(products.map((p) => [p.id, { claims: 0, templates: 0 }]));
      for (const c of claims ?? []) counts[c.product_id].claims++;
      for (const t of tpls ?? []) counts[t.product_id].templates++;
    }
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-9 sm:px-10">
      <PageHeader
        title="Products"
        description="Everything starts with a product. Pick one to create compliant content from its approved knowledge."
        actions={
          isAdmin ? (
            <Button asChild>
              <Link href="/products/new">+ New product</Link>
            </Button>
          ) : undefined
        }
      />

      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="A product holds its approved documents, claims, disclaimers, and templates. Products are set up during onboarding."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-5 transition-colors hover:border-brand hover:shadow-elevated"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-brand-dark text-[13px] font-bold text-white">
                  {p.name[0]}
                </span>
                <span className="min-w-0 flex-1 truncate text-[16px] font-bold text-ink">
                  {p.name}
                </span>
                <ProductStatusBadge status={p.status} />
              </div>
              {p.description ? (
                <p className="line-clamp-3 text-[13px] leading-relaxed text-ink-muted">
                  {p.description}
                </p>
              ) : (
                <p className="text-[13px] italic text-ink-faint">No description yet.</p>
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
