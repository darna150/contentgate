import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NotebookClient } from "./notebook-client";
import type { SessionMessage } from "./actions";

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
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
      .select("id, title, product_id")
      .order("title"),
  ]);

  const sessions = (rawSessions ?? []).map((s) => ({
    id: s.id as string,
    product_id: s.product_id as string,
    title: s.title as string,
    messages: (s.messages ?? []) as SessionMessage[],
    updated_at: s.updated_at as string,
    created_at: s.created_at as string,
  }));
  const initialProductId = (products ?? []).some(
    (product) => product.id === requestedProductId
  )
    ? requestedProductId ?? null
    : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <NotebookClient
        products={(products ?? []).map((p) => ({ id: p.id, name: p.name }))}
        initialSessions={sessions}
        initialProductId={initialProductId}
        docs={(docs ?? []).map((d) => ({
          id: d.id,
          title: d.title,
          product_id: d.product_id as string | null,
        }))}
      />
    </div>
  );
}
