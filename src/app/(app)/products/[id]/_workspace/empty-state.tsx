import Link from "next/link";
import type { WorkspaceEmptyStateCode } from "@/lib/product-workspace";

const COPY: Record<WorkspaceEmptyStateCode, { title: string; body: string }> = {
  upload_first_asset: {
    title: "No assets yet",
    body: "Upload the first logo, packshot, background, or supporting image for this product.",
  },
  add_approved_knowledge: {
    title: "No approved knowledge yet",
    body: "Add a source document or an approved claim so generated content stays grounded.",
  },
  add_approved_source: {
    title: "No source documents",
    body: "Add an approved source document to ground this product's content.",
  },
  add_approved_claim: {
    title: "No approved claims",
    body: "Add an approved claim this product can use in generated content.",
  },
  configure_template: {
    title: "No active template",
    body: "Configure a locked template before content can be generated.",
  },
  generate_first_content: {
    title: "No content yet",
    body: "Generate the first piece from one of this product's approved templates.",
  },
  queue_clear: {
    title: "The queue is clear",
    body: "Content submitted for review will appear here.",
  },
};

type Props = {
  code: WorkspaceEmptyStateCode;
  actionHref?: string | null;
  actionLabel?: string;
};

export function SectionEmpty({ code, actionHref, actionLabel }: Props) {
  const copy = COPY[code];
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-14 text-center">
      <p className="text-[15px] font-semibold">{copy.title}</p>
      <p className="max-w-md text-[13.5px] text-ink-muted">{copy.body}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-1 rounded-control bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
