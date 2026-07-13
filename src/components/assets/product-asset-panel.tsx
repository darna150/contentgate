"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AssetItem } from "./types";
import { AssetGrid } from "./asset-grid";
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
  productId: string;
  productName: string;
  productStatus: string;
  assets: AssetItem[];
  isAdmin: boolean;
};

export function ProductAssetPanel({
  productId,
  productName,
  productStatus,
  assets,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ type: "closed" });
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const visibleAssets = assets.filter((asset) => !deletedIds.has(asset.id));

  function closeDialog() {
    setDialog({ type: "closed" });
  }

  function refresh() {
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-[22px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-bold">Brand assets</h2>
          <p className="text-[12.5px] text-ink-muted">
            Manage logos, packshots, backgrounds, and supporting images.
          </p>
        </div>
        {isAdmin && productStatus === "active" && (
          <button
            type="button"
            onClick={() => setDialog({ type: "upload" })}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-control bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <UploadIcon className="h-3.5 w-3.5" /> Upload
          </button>
        )}
      </div>

      {visibleAssets.length === 0 ? (
        <p className="rounded-control border border-dashed border-edge-strong bg-page px-4 py-6 text-center text-[13px] text-ink-faint">
          No assets yet.{isAdmin ? " Upload one to get started." : ""}
        </p>
      ) : (
        <AssetGrid
          assets={visibleAssets}
          isAdmin={isAdmin}
          showProduct={false}
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
        <UploadAssetDialog
          products={[{ id: productId, name: productName, status: productStatus }]}
          fixedProductId={productId}
          onClose={closeDialog}
          onUploaded={refresh}
        />
      )}
    </div>
  );
}
