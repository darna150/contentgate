import { cn } from "@/lib/utils";

export type PipelineStatus = "draft" | "in_review" | "approved" | "rejected";

const ORDER = ["draft", "in_review", "approved"] as const;
const STEP_LABEL: Record<(typeof ORDER)[number], string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
};

export function StatusPipeline({ status }: { status: PipelineStatus }) {
  const rejected = status === "rejected";
  const activeIndex = rejected ? 0 : ORDER.indexOf(status);

  return (
    <div className="flex items-center" role="list" aria-label="Review status">
      {ORDER.map((step, index) => {
        const complete = index < activeIndex;
        const current = index === activeIndex;
        return (
          <div key={step} className="flex items-center" role="listitem">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  complete && "bg-brand text-white",
                  current && !rejected && "bg-brand text-white",
                  current && rejected && "bg-reject text-white",
                  !complete && !current && "border border-edge-strong bg-surface text-ink-faint"
                )}
              >
                {complete ? "✓" : index + 1}
              </span>
              <span
                className={cn(
                  "text-[11.5px] font-semibold",
                  current ? "text-ink" : complete ? "text-ink-muted" : "text-ink-faint"
                )}
              >
                {STEP_LABEL[step]}
                {current && rejected ? " · Returned" : ""}
              </span>
            </div>
            {index < ORDER.length - 1 && (
              <span
                className={cn("mx-2 h-px w-6", complete ? "bg-brand" : "bg-edge")}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
