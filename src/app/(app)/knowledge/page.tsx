import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type DocRow = {
  id: string;
  title: string;
  storage_path: string | null;
  created_at: string;
  paragraphs: { n: number }[] | null;
  products: { name: string } | { name: string }[] | null;
};

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 13V4M6.5 7.5L10 4l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 13.5v1.5a2 2 0 002 2h9a2 2 0 002-2v-1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default async function KnowledgePage() {
  let docs: DocRow[] = [];

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("documents")
      .select("id, title, storage_path, created_at, paragraphs, products(name)")
      .order("created_at", { ascending: false });
    docs = (data as DocRow[]) ?? [];
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-10 py-9">
      <div className="flex items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-serif text-[28px] font-semibold">Source documents</h1>
          <p className="text-[14.5px] text-ink-muted">
            Every approved document across your products, in one place.
          </p>
        </div>
        <div className="flex-1" />
        <Link
          href="/knowledge/new"
          className="flex items-center gap-2 rounded-control bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          <UploadIcon />
          Add document
        </Link>
      </div>

      {docs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge-strong bg-surface px-8 py-16 text-center">
          <p className="text-[15px] font-semibold">No documents yet</p>
          <p className="max-w-md text-sm text-ink-muted">
            Add a product&apos;s approved guides, claim sheets, and FAQs.
            Generated content can only draw on what lives here.
          </p>
          <Link
            href="/knowledge/new"
            className="mt-2 flex items-center gap-2 rounded-control bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <UploadIcon />
            Add your first document
          </Link>
        </div>
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
            {docs.map((doc) => {
              const product = Array.isArray(doc.products) ? doc.products[0] : doc.products;
              return (
                <li key={doc.id}>
                  <Link
                    href={`/knowledge/${doc.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-page"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#EDF0EC] text-[9.5px] font-bold text-ink-muted">
                      {doc.storage_path ? "FILE" : "TEXT"}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-semibold">{doc.title}</span>
                      <span className="text-[11.5px] text-ink-faint">
                        {product?.name ? `${product.name} · ` : "Unassigned · "}
                        {doc.paragraphs?.length ?? 0} paragraphs ·{" "}
                        {new Date(doc.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </span>
                    <span className="inline-flex rounded-full bg-approve-tint px-[9px] py-0.5 text-[11.5px] font-semibold text-approve">
                      Indexed
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
