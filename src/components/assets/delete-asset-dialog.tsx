"use client";

import { useState, useTransition } from "react";
import { deleteProductAsset } from "@/app/(app)/products/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "./modal";
import type { AssetItem } from "./types";

type Props = {
  asset: AssetItem;
  onDeleted: () => void;
  onClose: () => void;
};

export function DeleteAssetDialog({ asset, onDeleted, onClose }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteProductAsset(asset.id, asset.productId);
        onDeleted();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete this asset.");
      }
    });
  }

  return (
    <Modal title="Delete asset" onClose={onClose} maxWidthClassName="max-w-sm">
      <div className="flex flex-col gap-4">
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          Delete <span className="font-semibold text-ink">&ldquo;{asset.title}&rdquo;</span>?
          This permanently removes its metadata and the stored file. This
          cannot be undone.
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-control border border-reject-border bg-reject-tint px-3.5 py-2.5 text-[13px] text-reject"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? "Deleting…" : "Delete asset"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
