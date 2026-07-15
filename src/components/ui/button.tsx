import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control text-[13px] font-semibold transition-colors outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-brand text-white hover:bg-brand-dark",
        accent: "bg-accent text-white hover:bg-accent-dark",
        secondary: "bg-brand-tint text-brand hover:bg-brand-tint/70",
        outline:
          "border border-edge-strong bg-surface text-ink hover:border-brand hover:text-brand",
        ghost: "text-ink-muted hover:bg-page hover:text-ink",
        destructive: "bg-reject text-white hover:bg-reject/90",
        link: "text-brand underline-offset-4 hover:underline p-0 h-auto font-semibold",
      },
      size: {
        default: "h-[38px] px-4",
        sm: "h-8 px-3 text-[12.5px]",
        lg: "h-11 px-5 text-[14px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
