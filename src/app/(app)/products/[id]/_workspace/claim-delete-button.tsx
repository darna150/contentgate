"use client";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteClaim } from "../../actions";

export function ClaimDeleteButton({
  claimId,
  productId,
  claimText,
}: {
  claimId: string;
  productId: string;
  claimText: string;
}) {
  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-[11.5px] font-semibold text-reject hover:bg-transparent hover:text-reject hover:underline"
        >
          Delete
        </Button>
      }
      title="Delete this claim?"
      description={`"${claimText}" will be removed and can no longer be used in generated content.`}
      confirmLabel="Delete claim"
      onConfirm={() => deleteClaim(claimId, productId)}
    />
  );
}
