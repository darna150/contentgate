"use client";

import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import { publicContentGateBundleAssetPath } from "@/lib/template-platform/public-contentgate-assets";
import type { TemplateBundleRuntimeBackgroundOption } from "@/lib/template-platform/runtime";
import { cn } from "@/lib/utils";

function backgroundPreviewSrc(
  manifest: TemplateBundleManifest,
  assetPath: string
) {
  const publicPath = publicContentGateBundleAssetPath(manifest, assetPath);
  if (publicPath) return publicPath;
  if (assetPath.startsWith("http://") || assetPath.startsWith("https://") || assetPath.startsWith("/")) {
    return assetPath;
  }
  return `/${assetPath}`;
}

export function StudioBackgroundPicker({
  manifest,
  options,
  value,
  editable,
  onChange,
}: {
  manifest: TemplateBundleManifest;
  options: TemplateBundleRuntimeBackgroundOption[];
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
}) {
  if (options.length < 2) return null;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-label text-ink-faint">Background style</span>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
            Swaps the locked background design only — your headline, CTA, and other copy stay
            exactly as written.
          </p>
        </div>
        {!editable && <Badge variant="neutral">Locked</Badge>}
      </div>

      <div
        role="radiogroup"
        aria-label="Background style"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2"
      >
        {options.map((option) => {
          const selected = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              onClick={() => editable && onChange(option.key)}
              disabled={!editable}
              aria-checked={selected}
              title={option.label}
              className={cn(
                "group relative overflow-hidden rounded-control border-2 bg-page text-left transition",
                selected
                  ? "border-brand shadow-elevated"
                  : "border-transparent ring-1 ring-inset ring-edge",
                editable && !selected && "hover:ring-brand/50 hover:shadow-elevated",
                !editable && "cursor-default",
                !editable && !selected && "opacity-55"
              )}
            >
              <span className="block aspect-[4/3] overflow-hidden bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={backgroundPreviewSrc(manifest, option.thumbnailAssetPath)}
                  alt={`${option.label} background preview`}
                  className={cn(
                    "h-full w-full object-cover transition duration-200",
                    editable && "group-hover:scale-[1.04]"
                  )}
                  loading="lazy"
                />
              </span>
              {selected && (
                <span
                  className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-brand text-white shadow-elevated"
                  aria-hidden="true"
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
              <span
                className={cn(
                  "block truncate px-2.5 py-2 text-[11.5px] font-bold",
                  selected ? "text-brand" : "text-ink"
                )}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
