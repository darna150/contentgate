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

const LANGUAGES = ["English", "Filipino", "Spanish", "Portuguese", "Vietnamese", "Thai"];

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
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="studio-language" className="text-[11px] normal-case tracking-normal">
          Copy language
        </Label>
        <Select value={language} onValueChange={onLanguageChange}>
          <SelectTrigger id="studio-language" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-label text-ink-faint">Refinement suggestion</span>
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
        <div className="flex flex-wrap gap-1.5">
          {REVISION_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() =>
                onRevisionChange(selectedRevision === option.key ? null : option.key)
              }
              disabled={busy}
              aria-pressed={selectedRevision === option.key}
              title={option.instruction}
              className={cn(
                "rounded-full border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors disabled:opacity-50",
                selectedRevision === option.key
                  ? "border-brand bg-brand-tint text-brand"
                  : "border-edge-strong bg-surface text-ink-muted hover:border-brand hover:text-brand"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-ink-faint">
          Optional. Choose one direction before generating or refining the current draft.
        </p>
      </div>
      <Button type="button" onClick={onGenerate} disabled={busy || generationPaused}>
        {generationPaused ? retryLabel : busy ? "Generating preview…" : buttonLabel}
      </Button>
      {error && <p className="text-[12.5px] text-reject">{error}</p>}
    </div>
  );
}
