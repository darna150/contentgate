"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PreviewImage } from "@/components/preview-image";
import { AssetStatusBadge } from "./asset-status-badge";
import { ASSET_TYPE_LABELS, type AssetItem } from "./types";
import { formatDimensions, formatFileSize, fileTypeLabel } from "./format";
import { EyeIcon, PencilIcon, TrashIcon } from "./icons";

type Props = {
  asset: AssetItem;
  isAdmin: boolean;
  showProduct?: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function AssetCard({
  asset,
  isAdmin,
  showProduct = true,
  onPreview,
  onEdit,
  onDelete,
}: Props) {
  const dims = formatDimensions(asset.widthPixels, asset.heightPixels);

  return (
    <div className="flex flex-col gap-2.5 rounded-control border border-edge bg-surface p-2.5">
      <button
        type="button"
        onClick={onPreview}
        aria-label={`Preview ${asset.title}`}
        className="group relative aspect-square w-full overflow-hidden rounded-[6px] border border-edge bg-page focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
      >
        <PreviewImage
          src={asset.previewUrl}
          alt={asset.altText || asset.title}
          className="p-2"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-ink/0 opacity-0 transition-all group-hover:bg-ink/5 group-hover:opacity-100">
          <span className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-ink shadow-sm">
            <EyeIcon className="h-3.5 w-3.5" /> Preview
          </span>
        </span>
      </button>

      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink"
            title={asset.title}
          >
            {asset.title}
          </p>
          <AssetStatusBadge status={asset.approvalStatus} />
        </div>
        {showProduct && (
          <p className="truncate text-[11px] text-ink-faint">{asset.productName}</p>
        )}
        <p className="truncate text-[11px] text-ink-faint">
          {ASSET_TYPE_LABELS[asset.assetType]}
          {dims ? ` · ${dims}` : ""} · {fileTypeLabel(asset.mimeType)} ·{" "}
          {formatFileSize(asset.fileSizeBytes)}
        </p>
      </div>

      {asset.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 overflow-hidden">
          {asset.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="neutral" className="max-w-[90px] truncate border-none">
              #{tag}
            </Badge>
          ))}
          {asset.tags.length > 3 && (
            <span className="flex-shrink-0 text-[10.5px] text-ink-faint">
              +{asset.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="flex gap-1.5 border-t border-edge pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            title="Edit metadata"
            aria-label={`Edit ${asset.title}`}
            className="flex-1"
          >
            <PencilIcon className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            title="Delete asset"
            aria-label={`Delete ${asset.title}`}
            className="flex-1 hover:bg-reject-tint hover:text-reject"
          >
            <TrashIcon className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      )}
    </div>
  );
}
