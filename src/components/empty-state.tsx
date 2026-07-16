import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateAction =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-14 text-center",
        className
      )}
    >
      {Icon && (
        <span className="flex size-11 items-center justify-center rounded-full bg-brand-tint text-brand">
          <Icon className="size-5" />
        </span>
      )}
      <div className="flex flex-col gap-1.5">
        <p className="text-h2 text-ink">{title}</p>
        {description && (
          <p className="max-w-md text-body text-ink-muted">{description}</p>
        )}
      </div>
      {action &&
        (action.href ? (
          <Button asChild size="sm" className="mt-1">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button size="sm" className="mt-1" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
