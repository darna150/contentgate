"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SizeChip, type SizeChipStatus } from "@/components/size-chip";

export type ExportFormat = "png" | "jpeg" | "pdf";

export function StudioToolbar({
  sizes,
  activeSize,
  sizeLabel,
  sizeDims,
  sizeStatus,
  onSelectSize,
  statusSummary,
  exportFormat,
  onExportFormatChange,
  onDownload,
  downloading,
  downloadDisabled,
  downloadDisabledReason,
}: {
  sizes: string[];
  activeSize: string;
  sizeLabel: (size: string) => string;
  sizeDims: (size: string) => { w: number; h: number } | undefined;
  sizeStatus: (size: string) => SizeChipStatus;
  onSelectSize: (size: string) => void;
  statusSummary: string | null;
  exportFormat: ExportFormat;
  onExportFormatChange: (format: ExportFormat) => void;
  onDownload: () => void;
  downloading: boolean;
  downloadDisabled: boolean;
  downloadDisabledReason?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-edge bg-surface p-3">
      <span className="px-1 text-[12px] font-semibold text-ink-muted">Output size</span>
      {sizes.map((key) => (
        <SizeChip
          key={key}
          label={sizeLabel(key)}
          dims={sizeDims(key)}
          status={sizeStatus(key)}
          active={activeSize === key}
          onClick={() => onSelectSize(key)}
        />
      ))}
      <div className="hidden flex-1 xl:block" />
      {statusSummary && (
        <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[10.5px] font-bold uppercase text-brand">
          {statusSummary}
        </span>
      )}
      <Select value={exportFormat} onValueChange={(value) => onExportFormatChange(value as ExportFormat)}>
        <SelectTrigger size="sm" aria-label="Download format">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="png">PNG</SelectItem>
          <SelectItem value="jpeg">JPEG</SelectItem>
          <SelectItem value="pdf">PDF</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        onClick={onDownload}
        disabled={downloading || downloadDisabled}
        title={downloadDisabled ? downloadDisabledReason : undefined}
      >
        {downloading ? "Preparing…" : `Download ${exportFormat.toUpperCase()}`}
      </Button>
    </div>
  );
}
