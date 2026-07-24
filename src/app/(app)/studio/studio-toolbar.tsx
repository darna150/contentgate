"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SizeChipStatus } from "@/components/size-chip";
import { cn } from "@/lib/utils";

export type ExportFormat = "png" | "jpeg" | "pdf";
export type ExportScale = "1" | "2";

export function StudioToolbar({
  sizes,
  activeSize,
  sizeLabel,
  sizeDims,
  sizeStatus,
  onSelectSize,
  viewToggle,
}: {
  sizes: string[];
  activeSize: string;
  sizeLabel: (size: string) => string;
  sizeDims: (size: string) => { w: number; h: number } | undefined;
  sizeStatus: (size: string) => SizeChipStatus;
  onSelectSize: (size: string) => void;
  viewToggle?: { showOriginal: boolean; onShowOriginalChange: (showOriginal: boolean) => void };
}) {
  const prioritySizes = Array.from(
    new Set([activeSize, ...sizes.slice(0, 4)])
  ).filter((key) => sizes.includes(key));

  return (
    <div className="flex flex-col gap-4 border-b border-edge bg-surface px-8 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="grid flex-1 grid-cols-2 gap-x-5 gap-y-3 xl:grid-cols-3">
          {prioritySizes.map((key) => {
          const dims = sizeDims(key);
          const active = activeSize === key;
          const status = sizeStatus(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectSize(key)}
              className={cn(
                "rounded-full px-4 py-2 text-center transition-colors",
                active
                  ? "bg-ink text-white"
                  : "text-ink hover:bg-page"
              )}
              aria-pressed={active}
              title={status === "empty" ? "Not generated yet" : undefined}
            >
              <span className="block text-[14px] font-bold leading-tight">{sizeLabel(key)}</span>
              {dims && (
                <span
                  className={cn(
                    "mt-0.5 block text-[11px] font-medium leading-tight",
                    active ? "text-white/60" : "text-ink-faint"
                  )}
                >
                  {dims.w}×{dims.h}
                </span>
              )}
            </button>
          );
        })}
        </div>
        <Select value={activeSize} onValueChange={onSelectSize}>
          <SelectTrigger className="h-10 w-[160px] rounded-full text-[13px]" aria-label="All Studio sizes">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sizes.map((key) => {
              const dims = sizeDims(key);
              return (
                <SelectItem key={key} value={key}>
                  {sizeLabel(key)}{dims ? ` · ${dims.w}×${dims.h}` : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      {viewToggle && (
        <div className="flex w-fit items-center gap-1 rounded-full bg-page p-1">
          <button
            type="button"
            onClick={() => viewToggle.onShowOriginalChange(false)}
            className={cn(
              "rounded-full px-5 py-3 text-[14px] font-bold transition-colors",
              !viewToggle.showOriginal ? "bg-surface text-ink shadow-sm" : "text-ink-faint"
            )}
          >
            Your draft
          </button>
          <button
            type="button"
            onClick={() => viewToggle.onShowOriginalChange(true)}
            className={cn(
              "rounded-full px-5 py-3 text-[14px] font-bold transition-colors",
              viewToggle.showOriginal ? "bg-surface text-ink shadow-sm" : "text-ink-faint"
            )}
          >
            Brand reference
          </button>
        </div>
      )}
    </div>
  );
}

export function StudioExportBar({
  exportFormat,
  onExportFormatChange,
  exportScale,
  onExportScaleChange,
  onDownload,
  downloading,
  downloadDisabled,
  downloadDisabledReason,
  canDownloadDraft,
}: {
  exportFormat: ExportFormat;
  onExportFormatChange: (format: ExportFormat) => void;
  exportScale: ExportScale;
  onExportScaleChange: (scale: ExportScale) => void;
  onDownload: () => void;
  downloading: boolean;
  downloadDisabled: boolean;
  downloadDisabledReason?: string;
  canDownloadDraft: boolean;
}) {
  const buttonLabel = downloading
    ? "Preparing…"
    : downloadDisabled
      ? "Export — locked until approved"
      : canDownloadDraft
        ? `Download draft ${exportScale === "2" ? "2× " : ""}${exportFormat.toUpperCase()}`
        : `Export ${exportScale === "2" ? "2× " : ""}${exportFormat.toUpperCase()}`;

  return (
    <div className="flex items-center justify-end gap-3 border-t border-edge bg-surface px-10 py-5">
      <Select value={exportFormat} onValueChange={(value) => onExportFormatChange(value as ExportFormat)}>
        <SelectTrigger className="h-11 w-[104px] rounded-[8px] text-[15px]" aria-label="Download format">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="png">PNG</SelectItem>
          <SelectItem value="jpeg">JPEG</SelectItem>
          <SelectItem value="pdf">PDF</SelectItem>
        </SelectContent>
      </Select>
      <Select value={exportScale} onValueChange={(value) => onExportScaleChange(value as ExportScale)}>
        <SelectTrigger className="h-11 w-[134px] rounded-[8px] text-[15px]" aria-label="Download quality">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Exact size</SelectItem>
          <SelectItem value="2">2× QA</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        onClick={onDownload}
        disabled={downloading || downloadDisabled}
        title={downloadDisabled ? downloadDisabledReason : undefined}
        className={cn(
          "h-11 min-w-[260px] rounded-[8px] px-5 text-[14px] font-bold",
          downloadDisabled && "bg-page text-ink-faint hover:bg-page"
        )}
      >
        {buttonLabel}
      </Button>
    </div>
  );
}
