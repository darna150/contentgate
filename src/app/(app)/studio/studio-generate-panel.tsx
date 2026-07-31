"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REVISION_OPTIONS } from "@/lib/templates";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { value: "English", label: "English (EN)", locale: "en" },
  { value: "Filipino", label: "Filipino (FIL)", locale: "fil" },
  { value: "Spanish", label: "Spanish (ES)", locale: "es" },
  { value: "Portuguese", label: "Portuguese (PT)", locale: "pt" },
  { value: "Vietnamese", label: "Vietnamese (VI)", locale: "vi" },
  { value: "Thai", label: "Thai (TH)", locale: "th" },
];

export function StudioGeneratePanel({
  language,
  onLanguageChange,
  selectedRevision,
  onRevisionChange,
  onGenerate,
  busy,
  generationPaused,
  retryLabel,
  buttonLabel,
  error,
  warning,
  unavailableRevisions = {},
  allowedLocales = ["en"],
}: {
  language: string;
  onLanguageChange: (value: string) => void;
  selectedRevision: string | null;
  onRevisionChange: (value: string | null) => void;
  onGenerate: () => void;
  busy: boolean;
  generationPaused: boolean;
  retryLabel: string | null;
  buttonLabel: string;
  error: string | null;
  warning?: string | null;
  unavailableRevisions?: Record<string, string>;
  allowedLocales?: string[];
}) {
  const availableLanguages = LANGUAGES.filter((item) => allowedLocales.includes(item.locale));
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="studio-language" className="text-[14px] font-normal text-ink-muted">
          Language
        </Label>
        <Select value={language} onValueChange={onLanguageChange}>
          <SelectTrigger id="studio-language" className="h-[54px] w-full rounded-[8px] bg-surface px-4 text-[16px] font-normal text-ink">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableLanguages.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-label text-ink-faint">Refine</span>
          {selectedRevision && (
            <button
              type="button"
              onClick={() => onRevisionChange(null)}
              disabled={busy}
              className="text-[11px] font-semibold text-ink-faint hover:text-brand disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {REVISION_OPTIONS.slice(0, 4).map((option) => {
            const unavailableReason = unavailableRevisions[option.key];
            return (
            <button
              key={option.key}
              type="button"
              onClick={() =>
                onRevisionChange(selectedRevision === option.key ? null : option.key)
              }
              disabled={busy || Boolean(unavailableReason)}
              aria-pressed={selectedRevision === option.key}
              title={unavailableReason ?? option.instruction}
              className={cn(
                "rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50",
                selectedRevision === option.key
                  ? "border-brand bg-brand-tint text-brand"
                  : "border-edge-strong bg-surface text-ink-muted hover:border-brand hover:text-brand"
              )}
            >
              {option.label}
            </button>
            );
          })}
        </div>
        <details className="group">
          <summary className="cursor-pointer text-[12px] font-semibold text-ink-muted hover:text-brand">More directions</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {REVISION_OPTIONS.slice(4).map((option) => (
              <button key={option.key} type="button" onClick={() => onRevisionChange(selectedRevision === option.key ? null : option.key)} disabled={busy || Boolean(unavailableRevisions[option.key])} aria-pressed={selectedRevision === option.key} title={unavailableRevisions[option.key] ?? option.instruction} className={cn("rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50", selectedRevision === option.key ? "border-brand bg-brand-tint text-brand" : "border-edge-strong bg-surface text-ink-muted hover:border-brand hover:text-brand")}>{option.label}</button>
            ))}
          </div>
        </details>
        <p className="sr-only text-[11px] leading-relaxed text-ink-faint">
          Optional. Choose one direction before generating or refining the current draft.
        </p>
      </div>
      <Button
        type="button"
        onClick={onGenerate}
        disabled={busy || generationPaused}
        className="h-[50px] rounded-[7px] bg-ink text-[14px] font-bold text-white hover:bg-ink/90"
      >
        {generationPaused ? retryLabel : busy ? "Making every word earn its place…" : selectedRevision ? `Apply “${REVISION_OPTIONS.find((option) => option.key === selectedRevision)?.label ?? "direction"}”` : buttonLabel}
      </Button>
      {error && <p className="text-[12.5px] text-reject">{error}</p>}
      {!error && warning && (
        <p className="rounded-[6px] bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {warning}
        </p>
      )}
    </div>
  );
}
