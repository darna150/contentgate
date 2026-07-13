"use client";

import { AssetStatusBadge } from "./asset-status-badge";
import { ASSET_TYPE_LABELS, type AssetItem } from "./types";
import { formatDimensions, formatFileSize, formatDateTime, fileTypeLabel } from "./format";
import { Modal } from "./modal";
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
    <Modal title={asset.title} onClose={onClose} maxWidthClassName="max-w-2xl">
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
            <span className="rounded-full border border-edge-strong px-[9px] py-0.5 text-[11px] font-semibold text-ink-muted">
              {ASSET_TYPE_LABELS[asset.assetType]}
            </span>
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
                <span
                  key={tag}
                  className="max-w-full truncate rounded-full bg-page px-2.5 py-0.5 text-[11px] font-medium text-ink-muted"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {isAdmin && (
            <div className="mt-auto flex gap-2 border-t border-edge pt-3.5">
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1.5 rounded-control border border-edge-strong px-3.5 py-2 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-brand hover:text-brand"
              >
                <PencilIcon className="h-3.5 w-3.5" /> Edit metadata
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-1.5 rounded-control border border-reject-border px-3.5 py-2 text-[12.5px] font-semibold text-reject transition-colors hover:bg-reject-tint"
              >
                <TrashIcon className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
