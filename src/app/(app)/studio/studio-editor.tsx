"use client";

import Link from "next/link";
import { useState } from "react";
import { SIZES, renderUrl, type SizeKey } from "@/lib/creative";

export function StudioEditor({
  contentId,
  contentTitle,
  sizes,
}: {
  contentId: string;
  contentTitle: string;
  sizes: SizeKey[];
}) {
  const [size, setSize] = useState<SizeKey>(sizes[0]);
  const [downloading, setDownloading] = useState(false);

  const url = renderUrl(contentId, size);
  const dims = SIZES[size];
  const ratio = dims.w / dims.h;

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const link = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = link;
      a.download = `${contentTitle.replace(/[^\w]+/g, "-").toLowerCase()}-${size}.png`;
      a.click();
      URL.revokeObjectURL(link);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2.5 rounded-control border border-approve-border bg-approve-tint px-4 py-2.5">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-approve text-[11px] font-bold text-white">
          ✓
        </span>
        <span className="text-[13px] text-ink-muted">
          Approved content poured into its locked product template,{" "}
          <Link href={`/content/${contentId}`} className="font-semibold text-approve hover:underline">
            {contentTitle}
          </Link>
          . Design is fixed; only the size changes.
        </span>
      </div>

      <div className="grid grid-cols-[260px_1fr] items-start gap-6">
        <div className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-5">
          <span className="text-[13px] font-semibold">Size</span>
          <div className="flex flex-col gap-2">
            {sizes.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSize(key)}
                className={`flex items-center justify-between rounded-control border px-3 py-2.5 text-left transition-colors ${
                  size === key ? "border-brand bg-brand-tint" : "border-edge-strong hover:border-brand"
                }`}
              >
                <span className="text-[12.5px] font-semibold">{SIZES[key].label}</span>
                <span className="text-[10.5px] text-ink-faint">
                  {SIZES[key].w}×{SIZES[key].h}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={download}
            disabled={downloading}
            className="rounded-control bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {downloading ? "Preparing…" : "Download PNG"}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-control border border-edge-strong px-4 py-2.5 text-center text-[13px] font-semibold text-ink-muted transition-colors hover:border-brand"
          >
            Open full size
          </a>
        </div>

        <div className="flex items-center justify-center rounded-card border border-edge bg-page p-6">
          <div
            className="overflow-hidden rounded-[10px] shadow-lg"
            style={{
              width: ratio >= 1 ? "100%" : "auto",
              height: ratio >= 1 ? "auto" : "520px",
              aspectRatio: `${dims.w} / ${dims.h}`,
              maxWidth: "100%",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Asset preview" className="h-full w-full object-contain" />
          </div>
        </div>
      </div>
    </div>
  );
}
