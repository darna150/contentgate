import { cn } from "@/lib/utils";

const STYLES: Record<string, { label: string; className: string; dotClassName: string }> = {
  draft: {
    label: "Draft",
    className: "border-edge-strong bg-transparent text-ink-muted",
    dotClassName: "bg-ink-muted",
  },
  in_review: {
    label: "In review",
    className: "border-warn-border bg-warn-tint text-warn",
    dotClassName: "bg-warn",
  },
  approved: {
    label: "Approved",
    className: "border-approve-border bg-approve-tint text-approve",
    dotClassName: "bg-brand",
  },
  rejected: {
    label: "Rejected",
    className: "border-reject-border bg-reject-tint text-reject",
    dotClassName: "bg-reject",
  },
};

export function StatusPill({ status }: { status: string }) {
  const style = STYLES[status] ?? STYLES.draft;
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-[9px] py-0.5 text-[12px] font-semibold",
        style.className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dotClassName)} aria-hidden />
      {style.label}
    </span>
  );
}
