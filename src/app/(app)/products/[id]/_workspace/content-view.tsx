import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { studioContentUrl } from "@/lib/creative";
import type { ProductWorkspace } from "@/lib/product-workspace-server";
import { SectionEmpty } from "./empty-state";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ContentView({ workspace }: { workspace: ProductWorkspace }) {
  const { product, content, permissions } = workspace;

  if (content.length === 0) {
    return (
      <SectionEmpty
        code="generate_first_content"
        actionHref={
          permissions.canGenerateContent
            ? `/products/${product.id}?view=templates`
            : null
        }
        actionLabel={permissions.canGenerateContent ? "Go to templates" : undefined}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-ink-muted">
          Every piece generated for this product, from draft to approved.
        </p>
        <Link href="/content" className="text-[13px] font-semibold text-brand hover:underline">
          Open in Content →
        </Link>
      </div>
      <div className="flex flex-col gap-1 rounded-card border border-edge bg-surface p-3">
        {content.map((item) => {
          const meta = [
            item.templateVariant,
            item.targetLanguage,
            item.audience,
            `by ${item.creatorName ?? "a teammate"}`,
            formatDate(item.updatedAt),
          ].filter(Boolean);
          return (
            <Link
              key={item.id}
              href={studioContentUrl(item.id)}
              className="flex items-center gap-3.5 rounded-control px-3.5 py-3 transition-colors hover:bg-page"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13.5px] font-semibold">
                  {item.title}
                </span>
                <span className="truncate text-[11.5px] text-ink-faint">
                  {meta.join(" · ")}
                </span>
              </span>
              <StatusPill status={item.status} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
