import Link from "next/link";
import { cn } from "@/lib/utils";

export const WORKSPACE_VIEWS = [
  "overview",
  "templates",
  "content",
  "approvals",
  "knowledge",
  "assets",
] as const;

export type WorkspaceView = (typeof WORKSPACE_VIEWS)[number];

export const DEFAULT_WORKSPACE_VIEW: WorkspaceView = "overview";

export function parseWorkspaceView(value: string | undefined): WorkspaceView {
  return WORKSPACE_VIEWS.includes(value as WorkspaceView)
    ? (value as WorkspaceView)
    : DEFAULT_WORKSPACE_VIEW;
}

const LABELS: Record<WorkspaceView, string> = {
  overview: "Overview",
  templates: "Templates",
  content: "Content",
  approvals: "Approvals",
  knowledge: "Knowledge",
  assets: "Assets",
};

type Props = {
  productId: string;
  active: WorkspaceView;
  counts: Partial<Record<WorkspaceView, number>>;
};

export function WorkspaceTabs({ productId, active, counts }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Product workspace views"
      className="-mx-1 flex gap-1.5 overflow-x-auto border-b border-edge px-1 pb-3"
    >
      {WORKSPACE_VIEWS.map((view) => {
        const isActive = view === active;
        const count = counts[view];
        return (
          <Link
            key={view}
            href={`/products/${productId}?view=${view}`}
            role="tab"
            aria-selected={isActive}
            scroll={false}
            className={cn(
              "flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors",
              isActive
                ? "bg-brand-dark text-white"
                : "text-ink-muted hover:bg-page hover:text-ink"
            )}
          >
            {LABELS[view]}
            {typeof count === "number" && (
              <span
                className={cn(
                  "rounded-full px-[7px] py-px text-[11px] font-bold",
                  isActive ? "bg-white/15 text-white" : "bg-page text-ink-faint"
                )}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
