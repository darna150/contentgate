import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full rounded-control border border-edge-strong bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-reject",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
