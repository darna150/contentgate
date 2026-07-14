"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SIZES, type SizeKey } from "@/lib/creative";

const LANGUAGES = ["English", "Filipino", "Spanish", "Portuguese", "Vietnamese", "Thai"];

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
        router.push(`/content/${j.contentId}`);
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
