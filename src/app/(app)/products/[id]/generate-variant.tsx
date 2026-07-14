"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SIZES, type SizeKey } from "@/lib/creative";

const LANGUAGES = ["English", "Filipino", "Spanish", "Portuguese", "Vietnamese", "Thai"];
const LOADER_MESSAGES = [
  "Reading approved sources",
  "Writing copy for the selected size",
  "Checking the locked template fields",
  "Opening Studio preview",
] as const;

export function GenerateVariant({
  productId,
  templateId,
  platformAssignmentId,
  variant,
  sizes,
  initialSize,
  compact = false,
}: {
  productId: string;
  templateId?: string;
  platformAssignmentId?: string;
  variant: string;
  sizes: SizeKey[];
  initialSize: SizeKey;
  compact?: boolean;
}) {
  const router = useRouter();
  const [language, setLanguage] = useState("English");
  const [outputSize, setOutputSize] = useState<SizeKey>(
    sizes.includes(initialSize) ? initialSize : sizes[0]
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/products/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(platformAssignmentId
            ? { platformAssignmentId }
            : { productTemplateId: templateId }),
          language,
          outputSize,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Generation failed.");
        return;
      }
      if (j.platform) {
        const params = new URLSearchParams({
          product: productId,
          template: `platform:${platformAssignmentId ?? ""}`,
          content: j.contentId,
          size: (j.outputSize as string) ?? outputSize,
        });
        router.push(`/studio?${params.toString()}`);
        return;
      }
      const params = new URLSearchParams({
        product: productId,
        template: templateId ?? "",
        content: j.contentId,
        size: (j.outputSize as string) ?? outputSize,
      });
      router.push(`/studio?${params.toString()}`);
    } catch {
      setError("Generation failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {busy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-page/75 p-6 backdrop-blur-[3px]"
          role="status"
          aria-live="polite"
          aria-label="Generating template preview"
        >
          <div className="flex w-full max-w-[380px] flex-col items-center gap-4 rounded-card border border-edge bg-surface px-7 py-6 text-center shadow-xl">
            <div className="relative flex h-12 w-12 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand/15 motion-reduce:animate-none" />
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
                C
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[14px] font-bold text-ink">Generating your draft</p>
              <p className="text-[12.5px] text-ink-muted">
                This can take a moment while ContentGate fits copy to the selected format.
              </p>
            </div>
            <div className="grid w-full gap-2 text-left">
              {LOADER_MESSAGES.map((message, index) => (
                <div key={message} className="flex items-center gap-2 text-[12px] text-ink-muted">
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand"
                    style={{ animationDelay: `${index * 180}ms` }}
                  />
                  {message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <select
        value={outputSize}
        onChange={(e) => setOutputSize(e.target.value as SizeKey)}
        disabled={busy}
        aria-label="Output size"
        className="rounded-control border border-edge-strong bg-surface px-2.5 py-2 text-[12.5px] outline-none focus:border-brand"
      >
        {sizes.map((size) => (
          <option key={size} value={size}>
            {SIZES[size].label}
          </option>
        ))}
      </select>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        disabled={busy}
        className="rounded-control border border-edge-strong bg-surface px-2.5 py-2 text-[12.5px] outline-none focus:border-brand"
      >
        {LANGUAGES.map((l) => (
          <option key={l}>{l}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="whitespace-nowrap rounded-control bg-brand px-4 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy
          ? "Generating preview…"
          : compact
            ? "Generate"
            : `Generate ${variant}`}
      </button>
      {error && <span className="whitespace-nowrap text-[12px] text-reject">{error}</span>}
    </div>
  );
}
