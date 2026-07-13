"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Citation = {
  document_title: string;
  document_id: string | null;
  paragraph_n: number | null;
  excerpt: string;
};

export type SessionMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; citations: Citation[]; not_found: boolean };

export async function createSession(
  productId: string
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "No profile" };

  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("org_id", profile.org_id)
    .eq("status", "active")
    .maybeSingle();
  if (!product) return { error: "Product is unavailable" };

  const { data, error } = await supabase
    .from("notebook_sessions")
    .insert({ org_id: profile.org_id, user_id: user.id, product_id: productId })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed" };
  revalidatePath("/ask");
  return { id: data.id };
}

export async function saveSession(
  sessionId: string,
  messages: SessionMessage[],
  title: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  if (!Array.isArray(messages) || messages.length > 100) {
    return { error: "Conversation is too large to save" };
  }
  if (JSON.stringify(messages).length > 200_000) {
    return { error: "Conversation is too large to save" };
  }

  const safeTitle = title.trim().slice(0, 80) || "New conversation";

  const { data, error } = await supabase
    .from("notebook_sessions")
    .update({ messages, title: safeTitle, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  return data ? {} : { error: "Conversation was not found" };
}

export async function renameSession(
  sessionId: string,
  title: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const safeTitle = title.trim().slice(0, 80);
  if (!safeTitle) return { error: "Title is required" };

  const { error } = await supabase
    .from("notebook_sessions")
    .update({ title: safeTitle, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  revalidatePath("/ask");
  return error ? { error: error.message } : {};
}

export async function deleteSession(
  sessionId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("notebook_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id);

  revalidatePath("/ask");
  return error ? { error: error.message } : {};
}
