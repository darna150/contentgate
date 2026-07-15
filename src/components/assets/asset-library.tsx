"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageOff } from "lucide-react";
import type { AssetLibraryFilterState } from "@/lib/asset-library-filters";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { AssetItem, ProductOption } from "./types";
import { AssetFilterToolbar } from "./filter-toolbar";
import { AssetGrid } from "./asset-grid";
import { AssetList } from "./asset-list";
import { AssetPreviewDialog } from "./asset-preview-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      <PageHeader
        title="Asset Library"
        description="Governed logos, packshots, backgrounds, and images across your products."
        actions={
          isAdmin ? (
            <Button
              onClick={() => uploadProducts.length > 0 && setDialog({ type: "upload" })}
              disabled={uploadProducts.length === 0}
              title={
                uploadProducts.length === 0
                  ? "Create an active product before uploading"
                  : undefined
              }
            >
              <UploadIcon className="h-4 w-4" /> Upload asset
            </Button>
          ) : undefined
        }
      />

      <AssetFilterToolbar filters={filters} products={products} resultCount={visibleAssets.length} />

      {visibleAssets.length === 0 ? (
        <EmptyState
          icon={ImageOff}
          title={hasFilters ? "No assets match these filters" : "No assets yet"}
          description={
            hasFilters
              ? "Try a different search or reset filters to see the full library."
              : isAdmin
                ? "Upload your first logo, packshot, background, or image to get started."
                : "Assets will appear here once an admin uploads them."
          }
        />
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
        <Dialog open onOpenChange={(next) => !next && closeDialog()}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit asset metadata</DialogTitle>
            </DialogHeader>
            <AssetMetadataForm asset={dialog.asset} onCancel={closeDialog} onSaved={refresh} />
          </DialogContent>
        </Dialog>
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
