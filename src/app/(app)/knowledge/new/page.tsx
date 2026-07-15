import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddDocumentForm } from "./add-document-form";

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: productId } = await searchParams;

  let products: { id: string; name: string }[] = [];
  let presetName: string | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (me?.role !== "admin") redirect("/ask");
    const { data } = await supabase
      .from("products")
      .select("id, name")
      .order("name", { ascending: true });
    products = data ?? [];
    presetName = products.find((p) => p.id === productId)?.name ?? null;
  }

  const backHref = productId ? `/products/${productId}` : "/knowledge";
  const backLabel = presetName ? `← ${presetName}` : "← Knowledge";

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-9 sm:px-10">
      <div className="flex flex-col gap-1.5">
        <Link href={backHref} className="text-[13px] font-semibold text-brand hover:underline">
          {backLabel}
        </Link>
        <h1 className="font-serif text-[28px] font-semibold">Add source document</h1>
        <p className="text-[14.5px] text-ink-muted">
          {presetName
            ? `Add approved source knowledge to ${presetName}. Every paragraph becomes a citable source.`
            : "Upload a file or paste approved text. Every paragraph becomes a citable source for generated content."}
        </p>
      </div>
      <AddDocumentForm products={products} defaultProductId={productId} />
    </div>
  );
}
