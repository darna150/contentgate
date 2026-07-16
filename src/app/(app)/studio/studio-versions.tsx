import Link from "next/link";

import { Badge, type badgeVariants } from "@/components/ui/badge";
import { studioContentUrl } from "@/lib/creative";
import type { VariantProps } from "class-variance-authority";
import type { StudioContent } from "./studio-data";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  draft: "neutral",
  in_review: "warn",
  approved: "approve",
  rejected: "reject",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
};

function formatVersionTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Read + navigate only — selecting a past version is a real navigation to
// its canonical /studio/[contentId] URL, never a client-side state swap.
// This keeps "what's approved/current" entirely server-derived.
export function StudioVersions({
  versions,
  currentContentId,
  size,
}: {
  versions: StudioContent[];
  currentContentId: string | null;
  size: string;
}) {
  if (versions.length <= 1) return null;

  return (
    <div className="flex flex-col gap-2 rounded-card border border-edge bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-h2 text-ink">Versions for this size</p>
        <span className="text-caption text-ink-faint">{versions.length}</span>
      </div>
      <div className="flex flex-col gap-1">
        {versions.map((version, index) => {
          const isCurrent = version.id === currentContentId;
          return (
            <Link
              key={version.id}
              href={studioContentUrl(version.id, size)}
              className={`flex items-center justify-between gap-3 rounded-control px-3 py-2 text-[12.5px] transition-colors ${
                isCurrent
                  ? "bg-brand-tint text-brand"
                  : "text-ink-muted hover:bg-page hover:text-ink"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="font-semibold">
                  {index === 0 ? "Latest" : `Version ${versions.length - index}`}
                </span>
                <span className="text-ink-faint">{formatVersionTime(version.updatedAt)}</span>
              </span>
              <Badge variant={STATUS_VARIANT[version.status] ?? "neutral"}>
                {STATUS_LABEL[version.status] ?? version.status}
              </Badge>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
