import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NotebookClient } from "./notebook-client";
import type { SessionMessage } from "./actions";
import { documentIndexStatus } from "@/lib/document-index-status";

const WORKSPACE_NOTEBOOK_ID = "workspace";

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <NotebookClient
          products={[{ id: "preview-product", name: "Preview product" }]}
          initialSessions={[
            {
              id: "preview-session",
              product_id: "preview-product",
              title: "Approved launch claims",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              messages: [
                {
                  role: "user",
                  content: "What claims can local teams use?",
                },
                {
                  role: "assistant",
                  content:
                    "Local teams can use claims that are present in approved source documents and keep exports gated until review is complete.",
                  not_found: false,
                  citations: [
                    {
                      document_id: "preview-source",
                      document_title: "ContentGate approved source guide",
                      paragraph_n: 3,
                      excerpt:
                        "Approved source documents define the claims, disclaimers, and localization guidance available to generated content.",
                    },
                  ],
                },
              ],
            },
          ]}
          initialProductId="preview-product"
          docs={[
            {
              id: "preview-source",
              title: "ContentGate approved source guide",
              product_id: "preview-product",
              paragraphCount: 3,
              indexStatus: "indexed",
            },
          ]}
        />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { product: requestedProductId },
    { data: products },
    { data: rawSessions },
    { data: docs },
  ] = await Promise.all([
    searchParams,
    supabase
      .from("products")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("notebook_sessions")
      .select("id, product_id, title, messages, updated_at, created_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("documents")
      .select("id, title, product_id, paragraphs, content_text, storage_path")
      .order("title"),
  ]);

  const sessions = (rawSessions ?? []).map((s) => ({
    id: s.id as string,
    product_id: (s.product_id as string | null) ?? null,
    title: s.title as string,
    messages: (s.messages ?? []) as SessionMessage[],
    updated_at: s.updated_at as string,
    created_at: s.created_at as string,
  }));
  const productOptions = [
    { id: WORKSPACE_NOTEBOOK_ID, name: "All sources" },
    ...(products ?? []).map((p) => ({ id: p.id, name: p.name })),
  ];
  const initialProductId = requestedProductId === WORKSPACE_NOTEBOOK_ID
    ? WORKSPACE_NOTEBOOK_ID
    : (products ?? []).some(
    (product) => product.id === requestedProductId
  )
    ? requestedProductId ?? null
    : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <NotebookClient
        products={productOptions}
        initialSessions={sessions}
        initialProductId={initialProductId}
        docs={(docs ?? []).map((d) => ({
          id: d.id,
          title: d.title,
          product_id: d.product_id as string | null,
          paragraphCount: Array.isArray(d.paragraphs) ? d.paragraphs.length : 0,
          indexStatus: documentIndexStatus({
            contentText: d.content_text,
            paragraphs: d.paragraphs,
            storagePath: d.storage_path,
          }),
        }))}
      />
    </div>
  );
}
