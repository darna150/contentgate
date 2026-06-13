"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { segmentParagraphs } from "@/lib/paragraphs";

async function requireProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  return { supabase, user, profile };
}

function writeAudit(entry: {
  org_id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  detail?: Record<string, unknown>;
}) {
  // Audit inserts are service-role only (RLS blocks user clients).
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Promise.resolve();
  return createAdminClient()
    .from("audit_log")
    .insert(entry)
    .then(({ error }) => {
      if (error) console.error("audit_log insert failed:", error.message);
    });
}

export type CreateDocumentState = { error: string } | null;

export async function createDocument(
  _prev: CreateDocumentState,
  formData: FormData
): Promise<CreateDocumentState> {
  const { supabase, user, profile } = await requireProfile();

  const title = String(formData.get("title") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const file = formData.get("file");

  if (!title) return { error: "Give the document a title." };
  if (!content) return { error: "The document needs text content — paste or extract it first." };

  const paragraphs = segmentParagraphs(content);
  if (paragraphs.length === 0) return { error: "Could not split the text into paragraphs." };

  const id = crypto.randomUUID();
  let storagePath: string | null = null;

  if (file instanceof File && file.size > 0) {
    storagePath = `${profile.org_id}/${id}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
      });
    if (uploadError) {
      return { error: `File upload failed: ${uploadError.message}` };
    }
  }

  const { error } = await supabase.from("documents").insert({
    id,
    org_id: profile.org_id,
    uploaded_by: user.id,
    title,
    product_id: productId || null,
    storage_path: storagePath,
    content_text: content,
    paragraphs,
  });
  if (error) {
    return { error: `Could not save the document: ${error.message}` };
  }

  await writeAudit({
    org_id: profile.org_id,
    actor_id: user.id,
    action: "document.created",
    entity_type: "document",
    entity_id: id,
    detail: { title, paragraphs: paragraphs.length, uploaded_file: !!storagePath, product_id: productId || null },
  });

  revalidatePath("/knowledge");
  if (productId) {
    revalidatePath(`/products/${productId}`);
    redirect(`/products/${productId}`);
  }
  redirect(`/knowledge/${id}`);
}

export async function deleteDocument(id: string) {
  const { supabase, user, profile } = await requireProfile();

  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, storage_path")
    .eq("id", id)
    .single();
  if (!doc) return;

  // RLS allows delete only for admins of the same org.
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return;

  if (doc.storage_path) {
    await supabase.storage.from("documents").remove([doc.storage_path]);
  }

  await writeAudit({
    org_id: profile.org_id,
    actor_id: user.id,
    action: "document.deleted",
    entity_type: "document",
    entity_id: id,
    detail: { title: doc.title },
  });

  revalidatePath("/knowledge");
  redirect("/knowledge");
}
