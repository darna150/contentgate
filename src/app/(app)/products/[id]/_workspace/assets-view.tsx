import Link from "next/link";
import { ProductAssetPanel } from "@/components/assets/product-asset-panel";
import type { AssetItem } from "@/components/assets/types";
import type {
  ProductWorkspace,
  ProductWorkspaceAsset,
} from "@/lib/product-workspace-server";

function toAssetItem(
  asset: ProductWorkspaceAsset,
  productId: string,
  productName: string
): AssetItem {
  return {
    id: asset.id,
    productId,
    productName,
    assetType: asset.assetType,
    title: asset.title,
    description: asset.description,
    altText: asset.altText,
    originalFileName: asset.originalFileName ?? "",
    mimeType: asset.mimeType ?? "",
    fileSizeBytes: asset.fileSizeBytes ?? 0,
    widthPixels: asset.widthPixels,
    heightPixels: asset.heightPixels,
    tags: asset.tags,
    approvalStatus: asset.approvalStatus,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    previewUrl: asset.previewUrl,
  };
}

export function AssetsView({ workspace }: { workspace: ProductWorkspace }) {
  const { product, assets, permissions, sections } = workspace;
  const items = assets.map((asset) =>
    toAssetItem(asset, product.id, product.name)
  );

  return (
    <div className="flex flex-col gap-3">
      {sections.assets.actionHref && (
        <div className="flex justify-end">
          <Link
            href={sections.assets.actionHref}
            className="text-[13px] font-semibold text-brand hover:underline"
          >
            Open Assets →
          </Link>
        </div>
      )}
      <ProductAssetPanel
        productId={product.id}
        productName={product.name}
        productStatus={product.status}
        assets={items}
        isAdmin={permissions.canManageAssets}
      />
    </div>
  );
}
