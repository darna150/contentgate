"use client";

import { useState, useTransition } from "react";
import { deleteProductAsset } from "@/app/(app)/products/actions";
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
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-control border border-edge-strong px-4 py-2.5 text-[13px] font-semibold text-ink-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded-control bg-reject px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Delete asset"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
