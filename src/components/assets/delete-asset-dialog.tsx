"use client";

import { useState, useTransition } from "react";
import { archiveProductAsset } from "@/app/(app)/products/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
        await archiveProductAsset(asset.id, asset.productId);
        onDeleted();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not archive this asset.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Archive asset</DialogTitle>
        </DialogHeader>
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          Archive <span className="font-semibold text-ink">&ldquo;{asset.title}&rdquo;</span>?
          It will no longer appear in the library or be available for new work.
          Its stored file is retained for audit history.
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-control border border-reject-border bg-reject-tint px-3.5 py-2.5 text-[13px] text-reject"
          >
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? "Archiving…" : "Archive asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
