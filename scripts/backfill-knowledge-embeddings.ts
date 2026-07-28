import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { normalizeParagraphs } from "../src/lib/paragraphs";
import { buildContextualEmbeddingInputs } from "../src/lib/knowledge-chunking";

loadEnvConfig(process.cwd());

const embeddingModel = process.env.OPENAI_KNOWLEDGE_EMBEDDING_MODEL ?? "text-embedding-3-large";
const embeddingDimensions = 1536;

function required(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY" | "OPENAI_API_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for embedding backfill.`);
  return value;
}

async function main() {
  const supabase = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY")
  );
  const { data: documents, error: documentError } = await supabase
    .from("documents")
    .select("id, org_id, product_id, title, paragraphs")
    .eq("approval_status", "approved");
  if (documentError) throw new Error(`Could not load approved sources: ${documentError.message}`);

  const rows = (documents ?? []).flatMap((document) => {
    const paragraphs = normalizeParagraphs(document.paragraphs);
    const embeddingInputs = buildContextualEmbeddingInputs(
      document.title ?? "Approved source",
      paragraphs
    );
    return paragraphs.map((paragraph, index) => ({
      org_id: document.org_id as string,
      document_id: document.id as string,
      product_id: (document.product_id as string | null) ?? null,
      paragraph_n: paragraph.n,
      paragraph_text: paragraph.text,
      embedding_input: embeddingInputs[index],
    }));
  });
  if (rows.length === 0) {
    console.log("No approved paragraphs require embedding backfill.");
    return;
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${required("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: embeddingModel,
      input: rows.map((row) => row.embedding_input),
      dimensions: embeddingDimensions,
      encoding_format: "float",
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`OpenAI embeddings failed (${response.status}).`);

  const payload = (await response.json()) as { data?: Array<{ embedding?: unknown }> };
  const embeddings = payload.data?.map((item) => item.embedding) ?? [];
  if (
    embeddings.length !== rows.length ||
    !embeddings.every(
      (embedding) =>
        Array.isArray(embedding) &&
        embedding.length === embeddingDimensions &&
        embedding.every((value) => typeof value === "number" && Number.isFinite(value))
    )
  ) {
    throw new Error("OpenAI returned an invalid embedding payload.");
  }

  const { error: upsertError } = await supabase.from("knowledge_chunks").upsert(
    rows.map((row, index) => ({
      org_id: row.org_id,
      document_id: row.document_id,
      product_id: row.product_id,
      paragraph_n: row.paragraph_n,
      paragraph_text: row.paragraph_text,
      embedding: embeddings[index],
      embedding_model: embeddingModel,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "document_id,paragraph_n" }
  );
  if (upsertError) throw new Error(`Could not save embeddings: ${upsertError.message}`);

  console.log(`Embedded ${rows.length} approved paragraphs from ${documents?.length ?? 0} documents.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Embedding backfill failed.");
  process.exitCode = 1;
});
