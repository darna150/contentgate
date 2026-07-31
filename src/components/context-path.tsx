import Link from "next/link";

type ContextPathItem = { label: string; href?: string };

export function ContextPath({ items, className = "" }: { items: ContextPathItem[]; className?: string }) {
  return (
    <nav aria-label="Current location" className={`flex min-w-0 items-center gap-2 text-[12px] font-semibold text-ink-muted ${className}`}>
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
          {index > 0 && <span aria-hidden="true" className="text-ink-faint">/</span>}
          {item.href ? <Link href={item.href} className="truncate hover:text-brand hover:underline">{item.label}</Link> : <span aria-current="page" className="truncate text-ink">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
