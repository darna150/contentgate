"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ExportFormat = "png" | "jpeg" | "pdf";
export type ExportScale = "1" | "2";

export function StudioToolbar({
  sizes,
  activeSize,
  sizeLabel,
  sizeDims,
  onSelectSize,
  viewToggle,
}: {
  sizes: string[];
  activeSize: string;
  sizeLabel: (size: string) => string;
  sizeDims: (size: string) => { w: number; h: number } | undefined;
  onSelectSize: (size: string) => void;
  viewToggle?: { showOriginal: boolean; onShowOriginalChange: (showOriginal: boolean) => void };
}) {
  return (
    <div className="flex min-h-[64px] items-center justify-between gap-4 border-b border-edge bg-surface px-6 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Select value={activeSize} onValueChange={onSelectSize}>
          <SelectTrigger
            className="h-10 w-[340px] max-w-[52vw] rounded-[8px] border-edge-strong text-[13px] font-bold"
            aria-label="Size and format"
          >
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
        <div className="flex shrink-0 items-center gap-1 rounded-[8px] bg-page p-1">
          <button
            type="button"
            onClick={() => viewToggle.onShowOriginalChange(false)}
            className={cn(
              "rounded-[7px] px-3.5 py-2 text-[12.5px] font-bold transition-colors",
              !viewToggle.showOriginal ? "bg-surface text-ink shadow-sm" : "text-ink-faint"
            )}
          >
            Draft
          </button>
          <button
            type="button"
            onClick={() => viewToggle.onShowOriginalChange(true)}
            className={cn(
              "rounded-[7px] px-3.5 py-2 text-[12.5px] font-bold transition-colors",
              viewToggle.showOriginal ? "bg-surface text-ink shadow-sm" : "text-ink-faint"
            )}
          >
            Reference
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
