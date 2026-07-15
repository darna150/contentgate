"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-h2 text-ink">Brand assets</h2>
          <p className="text-caption text-ink-muted">
            Manage logos, packshots, backgrounds, and supporting images.
          </p>
        </div>
        {isAdmin && productStatus === "active" && (
          <Button size="sm" onClick={() => setDialog({ type: "upload" })} className="flex-shrink-0">
            <UploadIcon className="h-3.5 w-3.5" /> Upload
          </Button>
        )}
      </CardHeader>

      <CardContent>
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
      </CardContent>

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
    </Card>
  );
}
