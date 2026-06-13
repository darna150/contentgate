"use client";

import Link from "next/link";
import { useState } from "react";

export function ExportButtons({ id, body }: { id: string; body: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-approve-border bg-surface p-[22px]">
      <h2 className="text-[15px] font-bold">Export</h2>
      <p className="text-[13px] leading-relaxed text-ink-muted">
        This content is approved and ready to publish.
      </p>
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onCopy}
          className="flex-1 rounded-control bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          {copied ? "Copied!" : "Copy text"}
        </button>
        <a
          href={`/api/export/${id}`}
          className="flex-1 rounded-control border border-edge-strong px-4 py-2.5 text-center text-[13.5px] font-semibold text-ink transition-colors hover:border-brand"
        >
          Download .md
        </a>
      </div>
      <Link
        href={`/studio?content=${id}`}
        className="rounded-control border border-brand bg-brand-tint px-4 py-2.5 text-center text-[13.5px] font-semibold text-brand transition-opacity hover:opacity-90"
      >
        Create image asset →
      </Link>
    </div>
  );
}
