const STYLES: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-approve-tint text-approve" },
  archived: {
    label: "Archived",
    className: "bg-page text-ink-muted border border-edge-strong",
  },
  inactive: { label: "Inactive", className: "bg-[#FBF3E2] text-warn" },
};

export function ProductStatusBadge({ status }: { status: string }) {
  const style =
    STYLES[status] ?? {
      label: status.charAt(0).toUpperCase() + status.slice(1),
      className: "bg-page text-ink-muted border border-edge-strong",
    };
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded-full px-[9px] py-0.5 text-[11px] font-semibold ${style.className}`}
    >
      {style.label}
    </span>
  );
}
