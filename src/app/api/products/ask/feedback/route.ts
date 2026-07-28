import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FEEDBACK_REASONS = new Set([
  "inaccurate",
  "incomplete",
  "wrong_source",
  "unclear",
  "too_slow",
  "other",
]);

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: { queryId?: unknown; rating?: unknown; reason?: unknown; note?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const queryId = typeof payload.queryId === "string" ? payload.queryId : "";
  const rating = payload.rating === 1 || payload.rating === -1 ? payload.rating : null;
  const reason =
    typeof payload.reason === "string" && FEEDBACK_REASONS.has(payload.reason)
      ? payload.reason
      : null;
  const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 1_000) : null;
  if (!queryId || rating === null) {
    return NextResponse.json({ error: "Missing queryId or rating" }, { status: 400 });
  }

  const { data: query } = await supabase
    .from("knowledge_queries")
    .select("id, org_id")
    .eq("id", queryId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!query) return NextResponse.json({ error: "Answer was not found" }, { status: 404 });

  const { error } = await supabase.from("knowledge_query_feedback").upsert(
    {
      org_id: query.org_id,
      query_id: query.id,
      user_id: user.id,
      rating,
      reason: rating === -1 ? reason : null,
      note: rating === -1 ? note || null : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "query_id,user_id" }
  );
  if (error) {
    console.error("knowledge feedback failed:", error);
    return NextResponse.json({ error: "Could not save feedback" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
