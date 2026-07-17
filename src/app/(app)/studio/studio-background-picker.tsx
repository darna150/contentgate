"use client";

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
          <span className="text-label text-ink-faint">Background</span>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
            Choose from designer-approved locked backgrounds. This updates instantly without
            regenerating copy.
          </p>
        </div>
        {!editable && (
          <span className="rounded-full bg-page px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">
            Locked
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const selected = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => editable && onChange(option.key)}
              disabled={!editable}
              aria-pressed={selected}
              className={cn(
                "group overflow-hidden rounded-control border bg-page text-left transition",
                selected
                  ? "border-brand ring-2 ring-brand/15"
                  : "border-edge hover:border-brand/45",
                !editable && "cursor-default opacity-80"
              )}
            >
              <span className="block aspect-[4/3] overflow-hidden bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={backgroundPreviewSrc(manifest, option.thumbnailAssetPath)}
                  alt=""
                  className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  loading="lazy"
                />
              </span>
              <span className="flex items-center gap-2 px-2.5 py-2">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    selected ? "bg-brand" : "bg-ink-faint"
                  )}
                  aria-hidden="true"
                />
                <span className="truncate text-[11.5px] font-bold text-ink">
                  {option.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
