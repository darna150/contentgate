import { createClient } from "@/lib/supabase/server";
import { listProductAssets } from "@/lib/product-assets-server";
import {
  parseAssetLibrarySearchParams,
  type RawSearchParams,
} from "@/lib/asset-library-filters";
import { AssetLibrary } from "@/components/assets/asset-library";
import type { AssetItem, ProductOption } from "@/components/assets/types";
import type {
  ProductAssetApprovalStatus,
  ProductAssetType,
} from "@/lib/product-assets";

type Joined<T> = T | T[] | null;

type AssetRow = {
  id: string;
  product_id: string;
  asset_type: ProductAssetType;
  title: string;
  description: string | null;
  alt_text: string | null;
  original_file_name: string;
  mime_type: string;
  file_size_bytes: number;
  width_pixels: number | null;
  height_pixels: number | null;
  tags: string[] | null;
  approval_status: ProductAssetApprovalStatus;
  created_at: string;
  updated_at: string;
  previewUrl: string;
  products: Joined<{ id: string; name: string }>;
};

function one<T>(value: Joined<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const filters = parseAssetLibrarySearchParams(raw);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
        <AssetLibrary assets={[]} products={[]} filters={filters} isAdmin={false} />
      </div>
    );
  }

  const supabase = await createClient();
  const [{ assets: rawAssets, role }, { data: productRows }] = await Promise.all([
    listProductAssets({
      productId: filters.product || undefined,
      assetType: filters.type || undefined,
      approvalStatus: filters.status || undefined,
      tag: filters.tag || undefined,
      search: filters.q || undefined,
    }),
    supabase.from("products").select("id, name, status").order("name"),
  ]);

  const products: ProductOption[] = productRows ?? [];

  const assets: AssetItem[] = (rawAssets as AssetRow[]).map((row) => {
    const product = one(row.products);
    return {
      id: row.id,
      productId: row.product_id,
      productName: product?.name ?? "Unknown product",
      assetType: row.asset_type,
      title: row.title,
      description: row.description,
      altText: row.alt_text,
      originalFileName: row.original_file_name,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size_bytes,
      widthPixels: row.width_pixels,
      heightPixels: row.height_pixels,
      tags: row.tags ?? [],
      approvalStatus: row.approval_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      previewUrl: row.previewUrl,
    };
  });

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <AssetLibrary
        assets={assets}
        products={products}
        filters={filters}
        isAdmin={role === "admin"}
      />
    </div>
  );
}
