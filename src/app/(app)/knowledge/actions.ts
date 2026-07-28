"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeParagraphs, segmentParagraphs } from "@/lib/paragraphs";
import { extractDocumentText } from "@/lib/document-extraction";
import {
  createKnowledgeEmbeddings,
  KNOWLEDGE_EMBEDDING_MODEL,
} from "@/lib/knowledge-embeddings";
import { buildContextualEmbeddingInputs } from "@/lib/knowledge-chunking";
import {
  documentFileType,
  validateDocumentFile,
} from "@/lib/document-files";

async function requireAdminProfile() {
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
  if (profile.role !== "admin") throw new Error("Admins only");

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

async function indexApprovedDocument(input: {
  id: string;
  orgId: string;
  productId: string | null;
  title: string;
  paragraphs: Array<{ n: number; text: string }>;
}) {
  if (!process.env.OPENAI_API_KEY) return;
  const embeddings = await createKnowledgeEmbeddings(
    buildContextualEmbeddingInputs(input.title, input.paragraphs)
  );
  const { error } = await createAdminClient().from("knowledge_chunks").upsert(
    input.paragraphs.map((paragraph, index) => ({
      org_id: input.orgId,
      document_id: input.id,
      product_id: input.productId,
      paragraph_n: paragraph.n,
      paragraph_text: paragraph.text,
      embedding: embeddings[index],
      embedding_model: KNOWLEDGE_EMBEDDING_MODEL,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "document_id,paragraph_n" }
  );
  if (error) throw new Error(error.message);
}

export async function createDocument(
  _prev: CreateDocumentState,
  formData: FormData
): Promise<CreateDocumentState> {
  const { supabase, user, profile } = await requireAdminProfile();

  const title = String(formData.get("title") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  let content = String(formData.get("content") ?? "").trim();
  const file = formData.get("file");
  let uploadContentType: string | null = null;

  if (!title) return { error: "Give the document a title." };
  if (file instanceof File && file.size > 0) {
    try {
      uploadContentType = validateDocumentFile(file);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Invalid document." };
    }
  }
  if (!content && file instanceof File && file.size > 0) {
    try {
      content = (await extractDocumentText(file)) ?? "";
    } catch (error) {
      console.error("document extraction failed:", error);
      return {
        error:
          "The file was received, but its text could not be extracted. Paste the approved text and try again.",
      };
    }
  }
  if (!content) {
    return {
      error:
        "No readable text was found. Paste approved text for image files or unsupported formats.",
    };
  }

  const paragraphs = segmentParagraphs(content);
  if (paragraphs.length === 0) return { error: "Could not split the text into paragraphs." };

  const id = crypto.randomUUID();
  let storagePath: string | null = null;

  if (file instanceof File && file.size > 0) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
    storagePath = `${profile.org_id}/${id}/${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, file, {
        contentType: uploadContentType ?? "application/octet-stream",
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
    file_type: file instanceof File && file.size > 0 ? documentFileType(file) : "text",
  });
  if (error) {
    return { error: `Could not save the document: ${error.message}` };
  }

  try {
    await indexApprovedDocument({ id, orgId: profile.org_id, productId: productId || null, title, paragraphs });
  } catch (indexError) {
    console.error("knowledge embedding index failed:", indexError);
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
  const { supabase, user, profile } = await requireAdminProfile();

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

export async function setDocumentApprovalStatus(
  id: string,
  approvalStatus: "approved" | "inactive"
) {
  const { supabase, user, profile } = await requireAdminProfile();

  const { data: document, error: lookupError } = await supabase
    .from("documents")
    .select("id, title, product_id, paragraphs, approval_status")
    .eq("id", id)
    .single();
  if (lookupError || !document) {
    throw new Error("Source document not found.");
  }

  if (document.approval_status === approvalStatus) return;

  const { error } = await supabase
    .from("documents")
    .update({ approval_status: approvalStatus })
    .eq("id", id);
  if (error) {
    throw new Error(`Could not update source status: ${error.message}`);
  }

  try {
    if (approvalStatus === "approved") {
      await indexApprovedDocument({
        id: document.id,
        orgId: profile.org_id,
        productId: document.product_id,
        title: document.title,
        paragraphs: normalizeParagraphs(document.paragraphs),
      });
    } else {
      const { error: chunkDeleteError } = await createAdminClient()
        .from("knowledge_chunks")
        .delete()
        .eq("document_id", document.id);
      if (chunkDeleteError) throw new Error(chunkDeleteError.message);
    }
  } catch (indexError) {
    console.error("knowledge embedding index update failed:", indexError);
  }

  await writeAudit({
    org_id: profile.org_id,
    actor_id: user.id,
    action: "document.approval_status_changed",
    entity_type: "document",
    entity_id: id,
    detail: { title: document.title, from: document.approval_status, to: approvalStatus },
  });

  revalidatePath("/knowledge");
  revalidatePath(`/knowledge/${id}`);
}
