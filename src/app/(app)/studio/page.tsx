import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_SIZES, type SizeKey } from "@/lib/creative";
import { StudioEditor } from "./studio-editor";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-semibold">Asset preview</h1>
        <p className="text-[14.5px] text-ink-muted">
          The last step. An approved piece poured into its locked product template,
          ready to export.
        </p>
      </div>
      {children}
    </div>
  );
}

function Gate({ message }: { message: string }) {
  return (
    <Shell>
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-16 text-center">
        <p className="text-[15px] font-semibold">{message}</p>
        <p className="max-w-md text-sm text-ink-muted">
          Only approved content can be turned into an asset. Get a piece through
          review first.
        </p>
        <Link
          href="/content?status=approved"
          className="mt-2 rounded-control bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          See approved content
        </Link>
      </div>
    </Shell>
  );
}

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ content?: string }>;
}) {
  const { content: contentId } = await searchParams;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <Gate message="Connect a workspace to preview assets" />;
  }

  const supabase = await createClient();

  if (!contentId) {
    const { data: approved } = await supabase
      .from("generated_content")
      .select("id, title, target_language")
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    if (!approved || approved.length === 0) {
      return <Gate message="Nothing approved to turn into an asset yet" />;
    }
    return (
      <Shell>
        <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-[22px]">
          <h2 className="text-[15px] font-bold">Pick an approved piece</h2>
          <ul className="flex flex-col">
            {approved.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/studio?content=${row.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-page"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13.5px] font-semibold">{row.title}</span>
                    <span className="text-[11.5px] text-ink-faint">{row.target_language}</span>
                  </span>
                  <span className="text-[13px] font-semibold text-brand">Preview →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Shell>
    );
  }

  const { data: content } = await supabase
    .from("generated_content")
    .select("id, title, status, product_templates(category)")
    .eq("id", contentId)
    .single();

  if (!content) return <Gate message="That content could not be found" />;
  if (content.status !== "approved") return <Gate message="That piece isn't approved yet" />;

  const tpl = Array.isArray(content.product_templates)
    ? content.product_templates[0]
    : content.product_templates;
  const sizes: SizeKey[] = CATEGORY_SIZES[tpl?.category ?? "social"] ?? CATEGORY_SIZES.social;

  return (
    <Shell>
      <StudioEditor contentId={content.id} contentTitle={content.title} sizes={sizes} />
    </Shell>
  );
}
