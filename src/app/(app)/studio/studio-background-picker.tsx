"use client";

import { useRef } from "react";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { nextRovingIndex } from "@/lib/roving-focus";
import type { TemplateBundleRuntimeBackgroundOption } from "@/lib/template-platform/runtime";
import { cn } from "@/lib/utils";

function swatchStyle(option: TemplateBundleRuntimeBackgroundOption) {
  const key = `${option.key} ${option.label}`.toLowerCase();
  if (key.includes("dark") || key.includes("black")) return "bg-[#0A0A0A]";
  if (key.includes("mint")) return "bg-[#E4F5EE]";
  if (key.includes("sage") || key.includes("grid")) {
    return "bg-[#F0F2E9] [background-image:linear-gradient(rgba(10,10,10,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(10,10,10,0.04)_1px,transparent_1px)] [background-size:12px_12px]";
  }
  if (key.includes("terra") || key.includes("cream")) {
    return "bg-[#FAF3E4] before:absolute before:left-0 before:right-0 before:top-0 before:h-1 before:bg-[#B85B3A]";
  }
  return "bg-[#F5F5F7]";
}

export function StudioBackgroundPicker({
  options,
  value,
  editable,
  onChange,
}: {
  options: TemplateBundleRuntimeBackgroundOption[];
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
}) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  if (!options.length) return null;

  const hasMultipleOptions = options.length > 1;

  const selectedIndex = options.findIndex((option) => option.key === value);
  const focusableIndex = selectedIndex === -1 ? 0 : selectedIndex;

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!editable || !hasMultipleOptions) return;
    const nextIndex = nextRovingIndex(focusableIndex, event.key, options.length);
    if (nextIndex === null) return;
    event.preventDefault();
    onChange(options[nextIndex].key);
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="flex flex-col gap-3 border-t border-edge pt-5" data-testid="studio-background-picker">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-label text-ink-faint">Background style</span>
          {hasMultipleOptions && (
            <p className="mt-2 text-[14px] leading-6 text-ink-muted">
              Swaps the locked background design only. Copy stays exactly as written.
            </p>
          )}
        </div>
        {!editable ? (
          <Badge variant="neutral">Locked</Badge>
        ) : !hasMultipleOptions ? (
          <Badge variant="neutral">1 option</Badge>
        ) : null}
      </div>

      <div
        role="radiogroup"
        aria-label="Background style"
        onKeyDown={handleKeyDown}
        className="flex flex-wrap gap-3"
      >
        {options.map((option, index) => {
          const selected = value === option.key;
          return (
            <button
              key={option.key}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              tabIndex={index === focusableIndex ? 0 : -1}
              onClick={() => editable && hasMultipleOptions && onChange(option.key)}
              disabled={!editable || !hasMultipleOptions}
              aria-checked={selected}
              title={option.label}
              className={cn(
                "group relative flex size-[60px] overflow-hidden rounded-[8px] border-2 text-left transition",
                selected
                  ? "border-brand shadow-sm"
                  : "border-transparent ring-1 ring-inset ring-edge",
                editable && hasMultipleOptions && !selected && "hover:ring-brand/50",
                (!editable || !hasMultipleOptions) && "cursor-default",
                !editable && !selected && "opacity-55",
                swatchStyle(option)
              )}
            >
              {selected && (
                <span
                  className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-brand text-white shadow-elevated"
                  aria-hidden="true"
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
              )}
              <span className="sr-only">{option.label}</span>
            </button>
          );
        })}
      </div>
      {selectedIndex >= 0 && (
        <p className="text-[13px] font-bold text-ink">
          {options[selectedIndex].label}
        </p>
      )}
    </div>
  );
}
