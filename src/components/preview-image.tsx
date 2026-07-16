"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * <img> with a graceful placeholder on load failure and a lightweight
 * skeleton pulse until the image resolves — used anywhere a template or
 * asset preview is rendered from a URL that can 404 or be slow (card
 * grids, galleries), so a broken source never surfaces the browser's raw
 * broken-image icon.
 */
export function PreviewImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  if (state === "error") {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-1.5 bg-page text-center",
          className
        )}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-edge text-[13px] text-ink-faint">
          !
        </span>
        <span className="px-3 text-[11px] font-medium text-ink-faint">
          Preview unavailable
        </span>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full", className)}>
      {state === "loading" && (
        <div className="absolute inset-0 animate-pulse bg-edge" aria-hidden />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        // A cached image can finish loading before the onLoad listener is
        // attached, so the event never fires. This ref callback runs at
        // commit time and catches that already-loaded case immediately.
        ref={(el) => {
          if (el?.complete) {
            setState(el.naturalWidth > 0 ? "loaded" : "error");
          }
        }}
        src={src}
        alt={alt}
        loading="lazy"
        className={cn(
          "h-full w-full object-contain transition-opacity duration-200",
          state === "loaded" ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
      />
    </div>
  );
}
