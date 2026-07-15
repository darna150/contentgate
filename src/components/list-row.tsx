import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ListRow({
  href,
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  const content = (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-control px-3 py-3 transition-colors",
        href && "hover:bg-page",
        className
      )}
    >
      {children}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}
