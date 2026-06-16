import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteDocumentButton } from "./delete-button";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) notFound();

  const supabase = await createClient();
  const [{ data: doc }, { data: auth }] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, title, file_type, storage_path, content_text, paragraphs, created_at, uploaded_by, products(name), profiles(full_name)"
      )
      .eq("id", id)
      .single(),
    supabase.auth.getUser(),
  ]);
  if (!doc) notFound();

  let isAdmin = false;
  if (auth.user) {
    const { data: me } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();
    isAdmin = me?.role === "admin";
  }
  if (!isAdmin) redirect("/ask");

  const uploader = Array.isArray(doc.profiles) ? doc.profiles[0] : doc.profiles;
  const product = Array.isArray(doc.products) ? doc.products[0] : doc.products;
  const paragraphs = (doc.paragraphs ?? []) as { n: number; text: string }[];

  let fileUrl: string | null = null;
  if (doc.storage_path) {
    const { data: signed } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 60 * 60);
    fileUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="mx-auto flex max-w-[920px] flex-col gap-6 px-10 py-9">
      <div className="flex items-end gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Link
            href="/knowledge"
            className="text-[13px] font-semibold text-brand hover:underline"
          >
            ← Knowledge Hub
          </Link>
          <h1 className="font-serif text-[28px] font-semibold leading-tight">
            {doc.title}
          </h1>
          <p className="text-[13.5px] text-ink-muted">
            {product?.name ? `${product.name} · ` : "Workspace-wide · "}
            {paragraphs.length} citable paragraphs · added{" "}
            {new Date(doc.created_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            {uploader?.full_name ? ` by ${uploader.full_name}` : ""}
          </p>
        </div>
        <div className="flex-1" />
        {fileUrl && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-control border border-edge-strong px-4 py-2 text-[13px] font-semibold text-ink-muted transition-colors hover:border-brand hover:text-brand"
          >
            Original file
          </a>
        )}
        {isAdmin && <DeleteDocumentButton id={doc.id} />}
      </div>

      <div className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-6">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold">Source text</h2>
          <span className="rounded-[5px] bg-brand-tint px-[7px] py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand">
            Approved source
          </span>
        </div>
        <ol className="flex flex-col gap-4">
          {paragraphs.map((p) => (
            <li key={p.n} className="flex gap-3.5">
              <span className="mt-0.5 w-8 shrink-0 text-right text-[12px] font-bold text-brand">
                ¶{p.n}
              </span>
              <p className="whitespace-pre-line text-[14px] leading-[1.7] text-ink">
                {p.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
