"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AssetLibraryFilterState } from "@/lib/asset-library-filters";
import type { AssetItem, ProductOption } from "./types";
import { AssetFilterToolbar } from "./filter-toolbar";
import { AssetGrid } from "./asset-grid";
import { AssetList } from "./asset-list";
import { AssetPreviewDialog } from "./asset-preview-dialog";
import { Modal } from "./modal";
import { AssetMetadataForm } from "./asset-metadata-form";
import { DeleteAssetDialog } from "./delete-asset-dialog";
import { UploadAssetDialog } from "./upload-asset-dialog";
import { UploadIcon } from "./icons";

type DialogState =
  | { type: "closed" }
  | { type: "preview"; asset: AssetItem }
  | { type: "edit"; asset: AssetItem }
  | { type: "delete"; asset: AssetItem }
  | { type: "upload" };

type Props = {
  assets: AssetItem[];
  products: ProductOption[];
  filters: AssetLibraryFilterState;
  isAdmin: boolean;
};

export function AssetLibrary({ assets, products, filters, isAdmin }: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ type: "closed" });
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const visibleAssets = useMemo(
    () => assets.filter((asset) => !deletedIds.has(asset.id)),
    [assets, deletedIds]
  );
  const uploadProducts = products.filter((product) => product.status === "active");

  const hasFilters = Boolean(
    filters.q || filters.product || filters.type || filters.status || filters.tag
  );

  function closeDialog() {
    setDialog({ type: "closed" });
  }

  function refresh() {
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-serif text-[28px] font-semibold">Asset Library</h1>
          <p className="text-[14.5px] text-ink-muted">
            Governed logos, packshots, backgrounds, and images across your products.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => uploadProducts.length > 0 && setDialog({ type: "upload" })}
            disabled={uploadProducts.length === 0}
            title={uploadProducts.length === 0 ? "Create an active product before uploading" : undefined}
            className="flex flex-shrink-0 items-center gap-2 rounded-control bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UploadIcon className="h-4 w-4" /> Upload asset
          </button>
        )}
      </div>

      <AssetFilterToolbar filters={filters} products={products} resultCount={visibleAssets.length} />

      {visibleAssets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-16 text-center">
          <p className="text-[15px] font-semibold">
            {hasFilters ? "No assets match these filters" : "No assets yet"}
          </p>
          <p className="max-w-md text-sm text-ink-muted">
            {hasFilters
              ? "Try a different search or reset filters to see the full library."
              : isAdmin
                ? "Upload your first logo, packshot, background, or image to get started."
                : "Assets will appear here once an admin uploads them."}
          </p>
        </div>
      ) : filters.view === "list" ? (
        <AssetList
          assets={visibleAssets}
          isAdmin={isAdmin}
          onPreview={(asset) => setDialog({ type: "preview", asset })}
          onEdit={(asset) => setDialog({ type: "edit", asset })}
          onDelete={(asset) => setDialog({ type: "delete", asset })}
        />
      ) : (
        <AssetGrid
          assets={visibleAssets}
          isAdmin={isAdmin}
          onPreview={(asset) => setDialog({ type: "preview", asset })}
          onEdit={(asset) => setDialog({ type: "edit", asset })}
          onDelete={(asset) => setDialog({ type: "delete", asset })}
        />
      )}

      {dialog.type === "preview" && (
        <AssetPreviewDialog
          asset={dialog.asset}
          isAdmin={isAdmin}
          onClose={closeDialog}
          onEdit={() => setDialog({ type: "edit", asset: dialog.asset })}
          onDelete={() => setDialog({ type: "delete", asset: dialog.asset })}
        />
      )}

      {dialog.type === "edit" && (
        <Modal title="Edit asset metadata" onClose={closeDialog} maxWidthClassName="max-w-lg">
          <AssetMetadataForm asset={dialog.asset} onCancel={closeDialog} onSaved={refresh} />
        </Modal>
      )}

      {dialog.type === "delete" && (
        <DeleteAssetDialog
          asset={dialog.asset}
          onClose={closeDialog}
          onDeleted={() => {
            setDeletedIds((prev) => new Set(prev).add(dialog.asset.id));
            closeDialog();
            refresh();
          }}
        />
      )}

      {dialog.type === "upload" && (
        <UploadAssetDialog products={uploadProducts} onClose={closeDialog} onUploaded={refresh} />
      )}
    </div>
  );
}
