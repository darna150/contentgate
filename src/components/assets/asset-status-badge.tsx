import type { ProductAssetApprovalStatus } from "@/lib/product-assets";
import { ASSET_STATUS_LABELS } from "./types";

const STYLES: Record<ProductAssetApprovalStatus, string> = {
  pending: "bg-[#FBF3E2] text-warn",
  approved: "bg-approve-tint text-approve",
  rejected: "bg-reject-tint text-reject",
  archived: "bg-page text-ink-muted border border-edge-strong",
};

export function AssetStatusBadge({
  status,
}: {
  status: ProductAssetApprovalStatus;
}) {
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded-full px-[9px] py-0.5 text-[11px] font-semibold ${STYLES[status]}`}
    >
      {ASSET_STATUS_LABELS[status]}
    </span>
  );
}
