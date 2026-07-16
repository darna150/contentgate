"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AssetStatusBadge } from "./asset-status-badge";
import { ASSET_TYPE_LABELS, type AssetItem } from "./types";
import { formatDimensions, formatFileSize, formatDateTime, fileTypeLabel } from "./format";
import { PencilIcon, TrashIcon } from "./icons";

type Props = {
  asset: AssetItem;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function AssetPreviewDialog({ asset, isAdmin, onClose, onEdit, onDelete }: Props) {
  const dims = formatDimensions(asset.widthPixels, asset.heightPixels);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{asset.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="flex flex-shrink-0 items-center justify-center rounded-control border border-edge bg-page p-3 sm:w-[300px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.previewUrl}
              alt={asset.altText || asset.title}
              className="max-h-[320px] w-full rounded-[6px] object-contain"
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <AssetStatusBadge status={asset.approvalStatus} />
              <Badge variant="neutral">{ASSET_TYPE_LABELS[asset.assetType]}</Badge>
            </div>

            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-[12.5px]">
              <dt className="text-ink-faint">Product</dt>
              <dd className="min-w-0 truncate text-ink">{asset.productName}</dd>
              <dt className="text-ink-faint">File</dt>
              <dd className="min-w-0 truncate text-ink">{asset.originalFileName}</dd>
              <dt className="text-ink-faint">File type</dt>
              <dd className="text-ink">
                {fileTypeLabel(asset.mimeType)} · {formatFileSize(asset.fileSizeBytes)}
              </dd>
              {dims && (
                <>
                  <dt className="text-ink-faint">Dimensions</dt>
                  <dd className="text-ink">{dims}</dd>
                </>
              )}
              <dt className="text-ink-faint">Updated</dt>
              <dd className="text-ink">{formatDateTime(asset.updatedAt)}</dd>
              <dt className="text-ink-faint">Uploaded</dt>
              <dd className="text-ink">{formatDateTime(asset.createdAt)}</dd>
            </dl>

            {asset.description && (
              <p className="text-[12.5px] leading-relaxed text-ink-muted">{asset.description}</p>
            )}

            {asset.altText && (
              <p className="text-[11.5px] leading-relaxed text-ink-faint">
                <span className="font-semibold text-ink-muted">Alt text:</span> {asset.altText}
              </p>
            )}

            {asset.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {asset.tags.map((tag) => (
                  <Badge key={tag} variant="neutral" className="max-w-full truncate border-none">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}

            {isAdmin && (
              <div className="mt-auto flex gap-2 border-t border-edge pt-3.5">
                <Button variant="outline" onClick={onEdit}>
                  <PencilIcon className="h-3.5 w-3.5" /> Edit metadata
                </Button>
                <Button
                  variant="outline"
                  onClick={onDelete}
                  className="border-reject-border text-reject hover:border-reject-border hover:bg-reject-tint hover:text-reject"
                >
                  <TrashIcon className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
