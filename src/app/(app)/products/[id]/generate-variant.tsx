"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const LANGUAGES = ["English", "Filipino", "Spanish", "Portuguese", "Vietnamese", "Thai"];

export function GenerateVariant({
  templateId,
  variant,
}: {
  templateId: string;
  variant: string;
}) {
  const router = useRouter();
  const [language, setLanguage] = useState("English");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/products/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productTemplateId: templateId, language }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Generation failed.");
        return;
      }
      router.push(`/content/${j.contentId}`);
    } catch {
      setError("Generation failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
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
        className="rounded-control bg-brand px-4 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Generating…" : `Generate ${variant}`}
      </button>
      {error && <span className="text-[12px] text-reject">{error}</span>}
    </div>
  );
}
