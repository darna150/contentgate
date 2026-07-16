import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-[9px] py-0.5 text-[11px] font-semibold",
  {
    variants: {
      variant: {
        neutral: "border border-edge-strong bg-page text-ink-muted",
        brand: "bg-brand-tint text-brand",
        approve: "bg-approve-tint text-approve",
        reject: "bg-reject-tint text-reject",
        warn: "bg-warn-tint text-warn",
        accent: "bg-accent-tint text-accent-dark",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
