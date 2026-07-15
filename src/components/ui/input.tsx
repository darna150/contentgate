import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-[38px] w-full min-w-0 rounded-control border border-edge-strong bg-surface px-3 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-reject",
        className
      )}
      {...props}
    />
  );
}

export { Input };
