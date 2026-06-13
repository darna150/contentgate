import { createClient } from "@/lib/supabase/server";
import { AskClient } from "./ask-client";
import { ActivityPanel } from "./activity-panel";

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

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-6 px-10 py-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-[28px] font-semibold">Knowledge Hub</h1>
        <p className="text-[14.5px] text-ink-muted">
          Ask anything about a product. Every answer is grounded in approved sources only.
        </p>
      </div>
      <AskClient products={products ?? []} />
      {isAdmin && <ActivityPanel />}
    </div>
  );
}
