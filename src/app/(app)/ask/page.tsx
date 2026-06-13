import { createClient } from "@/lib/supabase/server";
import { AskClient } from "./ask-client";
import { ActivityPanel } from "./activity-panel";
import { MemberHistory } from "./member-history";

export default async function AskPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    isAdmin = me?.role === "admin";
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, name")
    .eq("status", "active")
    .order("name");

  // The current user's own question history. RLS already scopes reads to own
  // rows for members; the explicit user_id filter keeps it personal for admins too.
  const { data: myQueries } = await supabase
    .from("knowledge_queries")
    .select("id, question, answer, citations, not_found, created_at, products(name)")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(10);

  const history = (myQueries ?? []).map((q) => {
    const product = Array.isArray(q.products) ? q.products[0] : q.products;
    return {
      id: q.id,
      question: q.question,
      answer: q.answer,
      citations: (q.citations ?? []) as { document_title: string; excerpt: string }[],
      not_found: q.not_found,
      product_name: product?.name ?? "Unknown product",
      created_at: q.created_at,
    };
  });

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-semibold">Knowledge Hub</h1>
        <p className="text-[14.5px] text-ink-muted">
          Ask anything about a product. Every answer is grounded in approved sources only.
        </p>
      </div>
      <AskClient products={products ?? []} />
      <MemberHistory items={history} />
      {isAdmin && <ActivityPanel />}
    </div>
  );
}
