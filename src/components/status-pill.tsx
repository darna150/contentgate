import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const STYLES: Record<string, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "neutral" },
  in_review: { label: "In review", variant: "warn" },
  approved: { label: "Approved", variant: "approve" },
  rejected: { label: "Rejected", variant: "reject" },
};

export function StatusPill({ status }: { status: string }) {
  const style = STYLES[status] ?? STYLES.draft;
  return <Badge variant={style.variant}>{style.label}</Badge>;
}
