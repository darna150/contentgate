"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminMfa } from "@/lib/auth/admin-mfa";
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
import { importSourcePage } from "@/lib/source-url";
import { normalizeSourceUrl } from "@/lib/source-url-shared";

async function requireAdminProfile() {
  const context = await requireAdminMfa();
  if (!context) throw new Error("Administrator MFA verification is required.");
  return {
    supabase: context.supabase,
    user: { id: context.userId },
    profile: { org_id: context.orgId, role: context.role },
  };
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

export type ImportSourceUrlResult =
  | {
      ok: true;
      url: string;
      title: string;
      content: string;
      aiAssisted: boolean;
    }
  | { ok: false; error: string };

export async function inspectSourceUrl(rawUrl: string): Promise<ImportSourceUrlResult> {
  await requireAdminProfile();
  try {
    const page = await importSourcePage(rawUrl);
    return { ok: true, ...page };
  } catch (error) {
    console.error("source URL import failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "That page could not be imported.",
    };
  }
}

export async function createDocument(
  _prev: CreateDocumentState,
  formData: FormData
): Promise<CreateDocumentState> {
  const { supabase, user, profile } = await requireAdminProfile();

  const title = String(formData.get("title") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  const rawSourceUrl = String(formData.get("source_url") ?? "").trim();
  let content = String(formData.get("content") ?? "").trim();
  const file = formData.get("file");
  let uploadContentType: string | null = null;
  let sourceUrl: string | null = null;

  if (!title) return { error: "Give the document a title." };
  if (rawSourceUrl) {
    try {
      sourceUrl = normalizeSourceUrl(rawSourceUrl);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Invalid source URL." };
    }
  }
  if (sourceUrl && file instanceof File && file.size > 0) {
    return { error: "Choose either a website URL or an uploaded file for each source." };
  }
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
    source_url: sourceUrl,
    content_text: content,
    paragraphs,
    file_type: sourceUrl
      ? "web"
      : file instanceof File && file.size > 0
        ? documentFileType(file)
        : "text",
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
    detail: {
      title,
      paragraphs: paragraphs.length,
      uploaded_file: !!storagePath,
      source_url: sourceUrl,
      product_id: productId || null,
    },
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
