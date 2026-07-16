"use client";

import { Button } from "@/components/ui/button";
import { PreviewImage } from "@/components/preview-image";
import { AssetStatusBadge } from "./asset-status-badge";
import { ASSET_TYPE_LABELS, type AssetItem } from "./types";
import { formatDimensions, formatFileSize, formatDate, fileTypeLabel } from "./format";
import { EyeIcon, PencilIcon, TrashIcon } from "./icons";

type Props = {
  asset: AssetItem;
  isAdmin: boolean;
  showProduct?: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

const ROW_GRID =
  "md:grid-cols-[44px_minmax(0,1.6fr)_minmax(0,1fr)_100px_110px_minmax(0,1fr)_90px_auto]";

export function AssetRow({
  asset,
  isAdmin,
  showProduct = true,
  onPreview,
  onEdit,
  onDelete,
}: Props) {
  const dims = formatDimensions(asset.widthPixels, asset.heightPixels);
  const meta = `${fileTypeLabel(asset.mimeType)} · ${formatFileSize(asset.fileSizeBytes)}${
    dims ? ` · ${dims}` : ""
  }`;

  const thumb = (
    <PreviewImage
      src={asset.previewUrl}
      alt={asset.altText || asset.title}
      className="p-1"
    />
  );

  const actions = (
    <div className="flex flex-shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={onPreview}
        title="Preview"
        aria-label={`Preview ${asset.title}`}
        className="h-7 w-7"
      >
        <EyeIcon className="h-3.5 w-3.5" />
      </Button>
      {isAdmin && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            title="Edit metadata"
            aria-label={`Edit ${asset.title}`}
            className="h-7 w-7"
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            title="Delete asset"
            aria-label={`Delete ${asset.title}`}
            className="h-7 w-7 hover:bg-reject-tint hover:text-reject"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  );

  return (
    <div className="border-b border-edge px-3 py-2.5 last:border-b-0">
      {/* Desktop / tablet row */}
      <div className={`hidden items-center gap-3 md:grid ${ROW_GRID}`}>
        <div className="h-11 w-11 overflow-hidden rounded-[6px] border border-edge bg-page">
          {thumb}
        </div>
        <button type="button" onClick={onPreview} className="min-w-0 text-left">
          <p className="truncate text-[13px] font-semibold text-ink hover:text-brand">
            {asset.title}
          </p>
          <p className="truncate text-[11px] text-ink-faint">{asset.originalFileName}</p>
        </button>
        <p className="truncate text-[12px] text-ink-muted">
          {showProduct ? asset.productName : "—"}
        </p>
        <p className="truncate text-[12px] text-ink-muted">{ASSET_TYPE_LABELS[asset.assetType]}</p>
        <AssetStatusBadge status={asset.approvalStatus} />
        <p className="truncate text-[11.5px] text-ink-faint">{meta}</p>
        <p className="truncate text-[11.5px] text-ink-faint">{formatDate(asset.updatedAt)}</p>
        {actions}
      </div>

      {/* Mobile row */}
      <div className="flex gap-3 md:hidden">
        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-[6px] border border-edge bg-page">
          {thumb}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-[13px] font-semibold text-ink">{asset.title}</p>
            <AssetStatusBadge status={asset.approvalStatus} />
          </div>
          <p className="truncate text-[11px] text-ink-faint">{asset.originalFileName}</p>
          <p className="truncate text-[11px] text-ink-faint">
            {showProduct ? `${asset.productName} · ` : ""}
            {ASSET_TYPE_LABELS[asset.assetType]} · {meta}
          </p>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-ink-faint">Updated {formatDate(asset.updatedAt)}</span>
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
}
