import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProduct, addClaim, setClaimStatus } from "../../actions";
import { ProductAssetPanel } from "@/components/assets/product-asset-panel";
import type { AssetItem } from "@/components/assets/types";
import { createProductAssetPreviewUrlMap } from "@/lib/product-assets-server";
import { ClaimDeleteButton } from "../_workspace/claim-delete-button";
import { ArchiveProductButton } from "../_workspace/archive-product-button";

const STATUS_LABELS: Record<string, string> = { approved: "Approved", inactive: "Inactive" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect(`/products/${id}`);

  const { data: product } = await supabase
    .from("products")
    .select("id, name, description, disclaimer_text, status")
    .eq("id", id)
    .single();
  if (!product) notFound();

  const [{ data: claims }, { data: assets }] = await Promise.all([
    supabase
      .from("product_claims")
      .select("id, claim_text, status")
      .eq("product_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("product_assets")
      .select(
        "id, product_id, asset_type, storage_path, title, description, alt_text, tags, approval_status, original_file_name, mime_type, file_size_bytes, width_pixels, height_pixels, created_at, updated_at"
      )
      .eq("product_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const updateThisProduct = updateProduct.bind(null, id);
  const addClaimToProduct = addClaim.bind(null, id);
  const assetPreviewUrls = await createProductAssetPreviewUrlMap(
    supabase,
    (assets ?? []).map((asset) => asset.storage_path)
  );

  const assetItems: AssetItem[] = (assets ?? []).map((asset) => ({
    id: asset.id,
    productId: asset.product_id,
    productName: product.name,
    assetType: asset.asset_type,
    title: asset.title,
    description: asset.description,
    altText: asset.alt_text,
    originalFileName: asset.original_file_name,
    mimeType: asset.mime_type,
    fileSizeBytes: asset.file_size_bytes,
    widthPixels: asset.width_pixels,
    heightPixels: asset.height_pixels,
    tags: asset.tags ?? [],
    approvalStatus: asset.approval_status,
    createdAt: asset.created_at,
    updatedAt: asset.updated_at,
    previewUrl: assetPreviewUrls.get(asset.storage_path) ?? "",
  }));

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-6 px-4 py-9 sm:px-10">
      <div className="flex flex-col gap-1.5">
        <a href={`/products/${id}`} className="text-[13px] font-semibold text-brand hover:underline">
          ← {product.name}
        </a>
        <h1 className="font-serif text-[28px] font-semibold">Edit product</h1>
      </div>

      {/* Product details */}
      <form action={updateThisProduct} className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-[22px]">
          <h2 className="text-[15px] font-bold">Product details</h2>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
              Product name <span className="text-reject">*</span>
            </label>
            <input
              name="name"
              required
              defaultValue={product.name}
              className="rounded-control border border-edge bg-page px-3.5 py-2.5 text-[13.5px] placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              defaultValue={product.description ?? ""}
              className="resize-none rounded-control border border-edge bg-page px-3.5 py-2.5 text-[13.5px] placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
              Mandatory disclaimer
            </label>
            <textarea
              name="disclaimer_text"
              rows={3}
              defaultValue={product.disclaimer_text ?? ""}
              className="resize-none rounded-control border border-edge bg-page px-3.5 py-2.5 text-[13.5px] placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-control bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Save details
          </button>
        </div>
      </form>

      {/* Claims */}
      <div className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-[22px]">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold">Approved claims</h2>
          <span className="rounded-[5px] bg-approve-tint px-[7px] py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-approve">
            {(claims ?? []).filter((c) => c.status === "approved").length} active
          </span>
        </div>
        <p className="text-[12.5px] text-ink-muted">
          Only approved claims are used in content generation. Set a claim to
          Inactive to stop it being used without deleting it.
        </p>

        {(claims ?? []).length === 0 ? (
          <p className="text-[13px] text-ink-faint">No claims yet — add one below.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {(claims ?? []).map((c) => {
              const isApproved = c.status === "approved";
              const toggleStatus = isApproved ? "inactive" : "approved";
              const toggleAction = setClaimStatus.bind(null, c.id, id, toggleStatus);
              return (
                <li key={c.id} className="flex items-start gap-3 rounded-[10px] border border-edge bg-page px-4 py-3">
                  <span className={`mt-0.5 text-[13px] ${isApproved ? "text-approve" : "text-ink-faint"}`}>
                    {isApproved ? "✓" : "○"}
                  </span>
                  <span className="flex-1 text-[13px] leading-snug text-ink">{c.claim_text}</span>
                  <div className="flex gap-2">
                    <form action={toggleAction}>
                      <button
                        type="submit"
                        className="text-[11.5px] font-semibold text-brand hover:underline"
                      >
                        {STATUS_LABELS[toggleStatus]}
                      </button>
                    </form>
                    <span className="text-ink-faint">·</span>
                    <ClaimDeleteButton
                      claimId={c.id}
                      productId={id}
                      claimText={c.claim_text}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Add claim */}
        <form action={addClaimToProduct} className="flex gap-2 border-t border-edge pt-4">
          <input
            name="claim_text"
            required
            placeholder="Enter an approved marketing claim…"
            className="flex-1 rounded-control border border-edge bg-page px-3.5 py-2.5 text-[13.5px] placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <button
            type="submit"
            className="whitespace-nowrap rounded-control bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            + Add claim
          </button>
        </form>
      </div>

      <ProductAssetPanel
        productId={id}
        productName={product.name}
        productStatus={product.status}
        assets={assetItems}
        isAdmin
      />

      {/* Danger zone */}
      <div className="flex flex-col gap-3 rounded-card border border-reject-border bg-surface p-[22px]">
        <h2 className="text-[14px] font-bold text-reject">Danger zone</h2>
        <p className="text-[12.5px] text-ink-muted">
          Archiving a product removes it from the product list and prevents new
          content from being generated. Existing content is preserved.
        </p>
        <ArchiveProductButton productId={id} />
      </div>
    </div>
  );
}
