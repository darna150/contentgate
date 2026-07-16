"use client";

import Link from "next/link";
import { useState } from "react";
import { studioContentUrl } from "@/lib/creative";

export function ExportButtons({
  id,
  body,
  outputSize,
}: {
  id: string;
  body: string;
  outputSize?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCopy() {
    setCopying(true);
    setError(null);
    try {
      const response = await fetch(`/api/export/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "clipboard_text",
          surface: "content_detail",
        }),
      });
      if (!response.ok) throw new Error("Export could not be recorded.");
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed. Refresh the page and try again.");
    } finally {
      setCopying(false);
    }
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
          disabled={copying}
          className="flex-1 rounded-control bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {copying ? "Recording…" : copied ? "Copied!" : "Copy text"}
        </button>
        <a
          href={`/api/export/${id}`}
          className="flex-1 rounded-control border border-edge-strong px-4 py-2.5 text-center text-[13.5px] font-semibold text-ink transition-colors hover:border-brand"
        >
          Download .md
        </a>
      </div>
      <Link
        href={studioContentUrl(id, outputSize)}
        className="rounded-control border border-brand bg-brand-tint px-4 py-2.5 text-center text-[13.5px] font-semibold text-brand transition-opacity hover:opacity-90"
      >
        Create image asset →
      </Link>
      {error && <p className="text-[12px] text-reject">{error}</p>}
    </div>
  );
}
