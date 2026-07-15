import { cn } from "@/lib/utils";

export type SizeChipStatus = "empty" | "draft" | "in_review" | "approved";

const DOT_CLASS: Record<SizeChipStatus, string> = {
  empty: "bg-edge-strong",
  draft: "bg-ink-faint",
  in_review: "bg-warn",
  approved: "bg-approve",
};

export function SizeChip({
  label,
  dims,
  status = "empty",
  active = false,
  onClick,
}: {
  label: string;
  dims?: { w: number; h: number };
  status?: SizeChipStatus;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-control border px-3 py-2 text-[12px] font-semibold whitespace-nowrap transition-colors",
        active
          ? "border-brand bg-brand-tint text-brand"
          : "border-edge text-ink-muted hover:border-edge-strong hover:text-ink"
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASS[status])} aria-hidden />
      <span>{label}</span>
      {dims && (
        <span className="text-ink-faint">
          {dims.w}×{dims.h}
        </span>
      )}
    </button>
  );
}
