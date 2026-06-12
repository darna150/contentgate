const STYLES: Record<string, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-page text-ink-muted border border-edge-strong",
  },
  in_review: {
    label: "In review",
    className: "bg-[#FBF3E2] text-warn",
  },
  approved: {
    label: "Approved",
    className: "bg-approve-tint text-approve",
  },
  rejected: {
    label: "Rejected",
    className: "bg-reject-tint text-reject",
  },
};

export function StatusPill({ status }: { status: string }) {
  const style = STYLES[status] ?? STYLES.draft;
  return (
    <span
      className={`inline-flex rounded-full px-[9px] py-0.5 text-[11.5px] font-semibold ${style.className}`}
    >
      {style.label}
    </span>
  );
}
