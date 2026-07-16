"use client";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { archiveProduct } from "../../actions";

export function ArchiveProductButton({ productId }: { productId: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-reject-border text-reject hover:bg-reject-tint"
        >
          Archive product
        </Button>
      }
      title="Archive this product?"
      description="Archiving a product removes it from the product list and prevents new content from being generated. Existing content is preserved."
      confirmLabel="Archive product"
      destructive={true}
      onConfirm={() => archiveProduct(productId)}
    />
  );
}
