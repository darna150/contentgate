import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-page px-6 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-tint text-brand">
        <Compass className="size-5" aria-hidden />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-h1 text-ink">Page not found</h1>
        <p className="max-w-md text-body text-ink-muted">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </main>
  );
}
