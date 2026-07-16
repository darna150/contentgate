import type { VariantProps } from "class-variance-authority";

import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { ProductAssetApprovalStatus } from "@/lib/product-assets";
import { ASSET_STATUS_LABELS } from "./types";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const STYLES: Record<ProductAssetApprovalStatus, BadgeVariant> = {
  pending: "warn",
  approved: "approve",
  rejected: "reject",
  archived: "neutral",
};

export function AssetStatusBadge({
  status,
}: {
  status: ProductAssetApprovalStatus;
}) {
  return <Badge variant={STYLES[status]}>{ASSET_STATUS_LABELS[status]}</Badge>;
}
