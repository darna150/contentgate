import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProduct } from "../actions";

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (me?.role !== "admin") redirect("/products");
  }

  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-6 px-4 py-9 sm:px-10">
      <div className="flex flex-col gap-1.5">
        <Link href="/products" className="text-[13px] font-semibold text-brand-strong hover:underline">
          ← Products
        </Link>
        <h1 className="text-h1 text-ink">New product</h1>
        <p className="text-[14.5px] text-ink-muted">
          A product holds its approved claims, source documents, and templates.
          You can add all of those after creation.
        </p>
      </div>

      <form action={createProduct} className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-[22px]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-name" className="text-[12px] tracking-[0.06em]">
              Product name <span className="text-reject">*</span>
            </Label>
            <Input
              id="product-name"
              name="name"
              required
              placeholder="e.g. PoultryShield Pro"
              className="bg-page px-3.5 md:text-[13.5px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-description" className="text-[12px] tracking-[0.06em]">
              Description
            </Label>
            <Textarea
              id="product-description"
              name="description"
              rows={3}
              placeholder="What this product does, who it's for, key use case."
              className="resize-none bg-page px-3.5 py-2.5 md:text-[13.5px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-disclaimer" className="text-[12px] tracking-[0.06em]">
              Mandatory disclaimer
            </Label>
            <Textarea
              id="product-disclaimer"
              name="disclaimer_text"
              rows={3}
              placeholder="Use only approved brand claims, imagery, offers, and local details."
              className="resize-none bg-page px-3.5 py-2.5 md:text-[13.5px]"
            />
            <p className="text-[11.5px] text-ink-faint">
              Locked into every asset generated for this product. Cannot be
              removed or edited by content creators.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/products"
            className="rounded-control border border-edge px-[18px] py-2.5 text-[13.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-control bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Create product
          </button>
        </div>
      </form>
    </div>
  );
}
