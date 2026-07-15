"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-control border border-edge bg-surface text-ink shadow-elevated text-[13px] font-medium",
          description: "text-ink-muted",
          actionButton: "bg-brand text-white",
          cancelButton: "bg-page text-ink-muted",
          error: "border-reject-border bg-reject-tint text-reject",
          success: "border-approve-border bg-approve-tint text-approve",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
export { toast } from "sonner";
