"use client";

import { useState } from "react";
import { createProductAssetDownloadUrl } from "@/app/(app)/products/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AssetStatusBadge } from "./asset-status-badge";
import { ASSET_TYPE_LABELS, type AssetItem } from "./types";
import { formatDimensions, formatDuration, formatFileSize, formatDateTime, fileTypeLabel } from "./format";
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
  const duration = formatDuration(asset.durationSeconds);
  const [imageFailed, setImageFailed] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const canDownload = asset.approvalStatus === "approved" || isAdmin;

  async function handleDownload() {
    setDownloadError(null);
    setDownloading(true);
    try {
      const url = await createProductAssetDownloadUrl(asset.id);
      window.location.href = url;
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Could not create download link.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{asset.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="flex h-[220px] flex-shrink-0 items-center justify-center rounded-control border border-edge bg-page p-3 sm:h-[320px] sm:w-[300px]">
            {asset.mediaKind === "video" ? (
              <video
                src={asset.previewUrl}
                className="max-h-full w-full rounded-[6px]"
                controls
                preload="metadata"
              />
            ) : imageFailed ? (
              <div className="flex flex-col items-center gap-1.5 text-center">
                <span className="flex size-8 items-center justify-center rounded-full bg-edge text-[13px] text-ink-faint">
                  !
                </span>
                <span className="px-3 text-[11px] font-medium text-ink-faint">
                  Preview unavailable
                </span>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={asset.previewUrl}
                alt={asset.altText || asset.title}
                className="max-h-full w-full rounded-[6px] object-contain"
                onError={() => setImageFailed(true)}
              />
            )}
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
              {duration && (
                <>
                  <dt className="text-ink-faint">Duration</dt>
                  <dd className="text-ink">{duration}</dd>
                </>
              )}
              {asset.category && (
                <>
                  <dt className="text-ink-faint">Category</dt>
                  <dd className="text-ink">{asset.category}</dd>
                </>
              )}
              <dt className="text-ink-faint">Downloads</dt>
              <dd className="text-ink">{asset.downloadCount}</dd>
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

            <div className="mt-auto flex flex-wrap gap-2 border-t border-edge pt-3.5">
              {canDownload && asset.previewUrl && (
                <Button type="button" variant="secondary" onClick={handleDownload} disabled={downloading}>
                  {downloading ? "Preparing…" : "Download asset"}
                </Button>
              )}
              {downloadError && (
                <p role="alert" className="basis-full text-[11.5px] leading-relaxed text-reject">
                  {downloadError}
                </p>
              )}
              {!canDownload && (
                <p className="text-[11.5px] leading-relaxed text-ink-faint">
                  Raw download is available after this asset is approved.
                </p>
              )}
              {isAdmin && (
                <>
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
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
