"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { nextRovingIndex } from "@/lib/roving-focus";
import {
  PREVIEW_ZOOM_OPTIONS,
  type PreviewZoom,
} from "@/lib/studio-preview-scale";
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

/**
 * Zoom selector for the preview stage.
 *
 * A radiogroup rather than a set of toggle buttons: the three levels are
 * mutually exclusive, so arrow keys move between them and only the selected
 * option is a tab stop.
 */
function PreviewZoomControl({
  zoom,
  onZoomChange,
  disabled,
}: {
  zoom: PreviewZoom;
  onZoomChange: (zoom: PreviewZoom) => void;
  disabled: boolean;
}) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = PREVIEW_ZOOM_OPTIONS.findIndex((option) => option.value === zoom);

  return (
    <div className="flex min-w-0 shrink-0 flex-col gap-1">
      <span
        id="studio-preview-zoom-label"
        className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-faint"
      >
        Zoom
      </span>
      <div
        role="radiogroup"
        aria-labelledby="studio-preview-zoom-label"
        className="flex items-center gap-1 rounded-[8px] bg-page p-1"
      >
        {PREVIEW_ZOOM_OPTIONS.map((option, index) => {
          const selected = option.value === zoom;
          return (
            <button
              key={option.value}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => onZoomChange(option.value)}
              // Arrow keys move selection within the group (ARIA APG radiogroup);
              // the handler sits on the radios because that is where focus is.
              onKeyDown={(event) => {
                const next = nextRovingIndex(
                  activeIndex,
                  event.key,
                  PREVIEW_ZOOM_OPTIONS.length
                );
                if (next === null) return;
                event.preventDefault();
                onZoomChange(PREVIEW_ZOOM_OPTIONS[next].value);
                optionRefs.current[next]?.focus();
              }}
              className={cn(
                "min-h-11 min-w-11 rounded-[7px] px-3 py-2 text-[12.5px] font-bold transition-colors",
                selected ? "bg-surface text-ink shadow-sm" : "text-ink-faint"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StudioToolbar({
  sizes,
  activeSize,
  sizeLabel,
  sizeDims,
  onSelectSize,
  disabled = false,
  viewToggle,
  zoom,
  onZoomChange,
}: {
  sizes: string[];
  activeSize: string;
  sizeLabel: (size: string) => string;
  sizeDims: (size: string) => { w: number; h: number } | undefined;
  onSelectSize: (size: string) => void;
  /** Keep the selected format stable while an in-flight generation owns it. */
  disabled?: boolean;
  viewToggle?: { showOriginal: boolean; onShowOriginalChange: (showOriginal: boolean) => void };
  zoom?: PreviewZoom;
  onZoomChange?: (zoom: PreviewZoom) => void;
}) {
  const formatGroups = sizes.reduce<Record<string, string[]>>((groups, key) => {
    const channel = formatChannel(key, sizeLabel(key));
    (groups[channel] ??= []).push(key);
    return groups;
  }, {});
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-edge bg-surface px-4 py-3 md:min-h-[64px] md:flex-nowrap md:items-center md:gap-4 md:px-6">
      <div className="flex w-full min-w-0 flex-col gap-1 md:w-auto">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-faint">
          Formats
        </span>
        <Select value={activeSize} onValueChange={onSelectSize} disabled={disabled}>
          <SelectTrigger
            className="h-11 w-full rounded-[8px] border-edge-strong text-[13px] font-bold md:w-[340px] md:max-w-[52vw]"
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
      <div className="flex w-full min-w-0 flex-wrap items-end gap-3 md:w-auto md:shrink-0 md:flex-nowrap md:items-center md:gap-4">
        {zoom && onZoomChange && (
          <PreviewZoomControl zoom={zoom} onZoomChange={onZoomChange} disabled={disabled} />
        )}
        {viewToggle && (
          <div className="flex max-w-full shrink-0 items-center gap-1 rounded-[8px] bg-page p-1">
            <button
              type="button"
              onClick={() => viewToggle.onShowOriginalChange(false)}
              disabled={disabled}
              className={cn(
                "min-h-11 rounded-[7px] px-3.5 py-2 text-[12.5px] font-bold transition-colors",
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
                "min-h-11 rounded-[7px] px-3.5 py-2 text-[12.5px] font-bold transition-colors",
                viewToggle.showOriginal ? "bg-surface text-ink shadow-sm" : "text-ink-faint"
              )}
            >
              Original design
            </button>
          </div>
        )}
      </div>
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
  isBrandReference = false,
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
  /**
   * The stage is showing the untouched template design rather than generated
   * content. That download is neither a draft QA proof nor an approved export,
   * so it must not borrow either label.
   */
  isBrandReference?: boolean;
}) {
  const qualifier = `${exportScale === "2" ? "2× " : ""}${exportFormat.toUpperCase()}`;
  const buttonLabel = downloading
    ? "Preparing…"
    : downloadDisabled
      ? "Export — locked until approved"
      : isBrandReference
        ? `Download original design ${qualifier}`
        : canDownloadDraft
          ? `Download draft ${qualifier}`
          : `Export approved ${qualifier}`;

  // A disabled button is not focusable, so a title tooltip is unreachable by
  // keyboard and invisible on touch. The reason is rendered as text instead and
  // still referenced by the button for the enabled case.
  const reasonId = "studio-export-reason";

  return (
    <div className="flex flex-col gap-2 border-t border-edge bg-surface px-4 py-4 md:px-10 md:py-5">
      <div className="flex flex-wrap items-center justify-end gap-3">
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
          aria-describedby={downloadDisabledReason ? reasonId : undefined}
          className={cn(
            "h-11 w-full min-w-0 rounded-[8px] px-5 text-[14px] font-bold sm:w-auto sm:min-w-[260px]",
            downloadDisabled && "bg-page text-ink-faint hover:bg-page"
          )}
        >
          {buttonLabel}
        </Button>
      </div>
      {downloadDisabledReason && (
        <p id={reasonId} className="text-right text-caption text-ink-muted">
          {downloadDisabledReason}
        </p>
      )}
    </div>
  );
}
