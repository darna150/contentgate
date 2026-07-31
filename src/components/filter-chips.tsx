import Link from "next/link";

import { cn } from "@/lib/utils";

export function FilterChips({
  options,
  activeValue,
  getHref,
}: {
  options: { label: string; value: string; count?: number }[];
  activeValue: string;
  getHref: (value: string) => string;
}) {
  return (
    <nav className="flex flex-wrap gap-1.5" aria-label="Content status filters">
      {options.map((option) => {
        const active = option.value === activeValue;
        return (
          <Link
            key={option.value}
            href={getHref(option.value)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
              active
                ? "border-brand-dark bg-brand-dark text-white"
                : "border-edge-strong text-ink-muted hover:border-brand hover:text-brand"
            )}
          >
            {option.label}
            {option.count != null && <span className="ml-1 opacity-70">{option.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
