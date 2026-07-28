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

function formatChannel(key: string, label: string) {
  const value = `${key} ${label}`.toLowerCase();
  if (value.includes("instagram") || value.includes("story") || value.includes("square")) return "Instagram";
  if (value.includes("facebook") || value.includes("meta")) return "Facebook / Meta";
  if (value.includes("linkedin")) return "LinkedIn";
  if (value.includes("leaderboard") || value.includes("rectangle") || value.includes("display")) return "Display";
  if (value.includes("a4") || value.includes("letter") || value.includes("print") || value.includes("poster")) return "Print";
  return "Other";
}

export function StudioToolbar({
  sizes,
  activeSize,
  sizeLabel,
  sizeDims,
  onSelectSize,
  disabled = false,
  viewToggle,
}: {
  sizes: string[];
  activeSize: string;
  sizeLabel: (size: string) => string;
  sizeDims: (size: string) => { w: number; h: number } | undefined;
  onSelectSize: (size: string) => void;
  /** Keep the selected format stable while an in-flight generation owns it. */
  disabled?: boolean;
  viewToggle?: { showOriginal: boolean; onShowOriginalChange: (showOriginal: boolean) => void };
}) {
  const formatGroups = sizes.reduce<Record<string, string[]>>((groups, key) => {
    const channel = formatChannel(key, sizeLabel(key));
    (groups[channel] ??= []).push(key);
    return groups;
  }, {});
  return (
    <div className="flex min-h-[64px] items-center justify-between gap-4 border-b border-edge bg-surface px-6 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-faint">
          Formats
        </span>
        <Select value={activeSize} onValueChange={onSelectSize} disabled={disabled}>
          <SelectTrigger
            className="h-10 w-[340px] max-w-[52vw] rounded-[8px] border-edge-strong text-[13px] font-bold"
            aria-label="Size and format"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(formatGroups).map(([channel, keys]) => (
              <div key={channel} className="py-1">
                <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">{channel}</p>
                {keys.map((key) => {
                  const dims = sizeDims(key);
                  return <SelectItem key={key} value={key}>{sizeLabel(key)}{dims ? ` · ${dims.w}×${dims.h}` : ""}</SelectItem>;
                })}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>
      {viewToggle && (
        <div className="flex shrink-0 items-center gap-1 rounded-[8px] bg-page p-1">
          <button
            type="button"
            onClick={() => viewToggle.onShowOriginalChange(false)}
            disabled={disabled}
            className={cn(
              "rounded-[7px] px-3.5 py-2 text-[12.5px] font-bold transition-colors",
              !viewToggle.showOriginal ? "bg-surface text-ink shadow-sm" : "text-ink-faint"
            )}
          >
            Working preview
          </button>
          <button
            type="button"
            onClick={() => viewToggle.onShowOriginalChange(true)}
            disabled={disabled}
            className={cn(
              "rounded-[7px] px-3.5 py-2 text-[12.5px] font-bold transition-colors",
              viewToggle.showOriginal ? "bg-surface text-ink shadow-sm" : "text-ink-faint"
            )}
          >
            Original design
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
