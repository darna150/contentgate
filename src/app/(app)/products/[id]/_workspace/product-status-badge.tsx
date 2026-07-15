import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const STYLES: Record<string, { label: string; variant: BadgeVariant }> = {
  active: { label: "Active", variant: "approve" },
  archived: { label: "Archived", variant: "neutral" },
  inactive: { label: "Inactive", variant: "warn" },
};

export function ProductStatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? {
    label: status.charAt(0).toUpperCase() + status.slice(1),
    variant: "neutral" as const,
  };
  return <Badge variant={style.variant}>{style.label}</Badge>;
}
