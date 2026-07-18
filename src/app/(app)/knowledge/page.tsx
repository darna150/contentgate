import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getDocumentPage } from "@/lib/document-listing";
import {
  documentIndexStatusClass,
  documentIndexStatusLabel,
  type DocumentIndexStatus,
} from "@/lib/document-index-status";
import type { FlattenedDocumentRow } from "@/lib/document-listing-shared";

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 13V4M6.5 7.5L10 4l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 13.5v1.5a2 2 0 002 2h9a2 2 0 002-2v-1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IndexStatusBadge({ status }: { status: DocumentIndexStatus }) {
  return (
    <Badge className={`${documentIndexStatusClass(status)} border-transparent`}>
      {documentIndexStatusLabel(status)}
    </Badge>
  );
}

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;

  let docs: FlattenedDocumentRow[] = [];
  let nextCursor: string | null = null;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (me?.role !== "admin") redirect("/ask");

    const page = await getDocumentPage({ cursor });
    docs = page.rows;
    nextCursor = page.nextCursor;
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-9 sm:px-10">
      <PageHeader
        title="Source documents"
        description="Every approved document across your products, in one place."
        actions={
          <Button asChild>
            <Link href="/knowledge/new">
              <UploadIcon />
              Add document
            </Link>
          </Button>
        }
      />

      {docs.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Add a product's approved guides, claim sheets, and FAQs. Generated content can only draw on what lives here."
          action={{ label: "Add your first document", href: "/knowledge/new" }}
        />
      ) : (
        <div className="flex flex-col gap-3.5 rounded-card border border-edge bg-surface p-[22px]">
          <div className="flex items-center">
            <h2 className="text-[15px] font-bold">Document library</h2>
            <div className="flex-1" />
            <span className="text-[12.5px] text-ink-faint">
              {docs.length} document{docs.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="flex flex-col">
            {docs.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/knowledge/${doc.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-page"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-edge text-[9.5px] font-bold text-ink-muted">
                    {doc.storagePath ? "FILE" : "TEXT"}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-semibold">{doc.title}</span>
                    <span className="text-[11.5px] text-ink-faint">
                      {doc.productName ? `${doc.productName} · ` : "Unassigned · "}
                      {doc.paragraphCount} paragraphs ·{" "}
                      {new Date(doc.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </span>
                  <IndexStatusBadge status={doc.indexStatus} />
                </Link>
              </li>
            ))}
          </ul>
          {nextCursor && (
            <Link
              href={`/knowledge?cursor=${nextCursor}`}
              className="rounded-control px-3.5 py-3 text-center text-[13px] font-semibold text-brand transition-colors hover:bg-page"
            >
              Load more documents
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
