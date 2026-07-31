import "server-only";
import {
  isKnowledgeEmbedding,
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
} from "./knowledge-embedding-contract";

export { KNOWLEDGE_EMBEDDING_DIMENSIONS } from "./knowledge-embedding-contract";
export const KNOWLEDGE_EMBEDDING_MODEL =
  process.env.OPENAI_KNOWLEDGE_EMBEDDING_MODEL ?? "text-embedding-3-large";

type EmbeddingResponse = {
  data?: Array<{ embedding?: unknown }>;
  usage?: {
    prompt_tokens?: unknown;
    total_tokens?: unknown;
  };
};

export async function createKnowledgeEmbeddingsWithUsage(inputs: readonly string[]) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI embeddings are not configured.");
  if (inputs.length === 0) return { embeddings: [], inputTokens: 0 };

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: KNOWLEDGE_EMBEDDING_MODEL,
      input: inputs,
      dimensions: KNOWLEDGE_EMBEDDING_DIMENSIONS,
      encoding_format: "float",
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`OpenAI embeddings failed (${response.status}).`);

  const payload = (await response.json()) as EmbeddingResponse;
  const embeddings = payload.data?.map((item) => item.embedding) ?? [];
  if (embeddings.length !== inputs.length || !embeddings.every(isKnowledgeEmbedding)) {
    throw new Error("OpenAI returned an invalid knowledge embedding payload.");
  }
  const reportedTokens = Number(
    payload.usage?.prompt_tokens ?? payload.usage?.total_tokens ?? 0
  );
  return {
    embeddings,
    inputTokens:
      Number.isInteger(reportedTokens) && reportedTokens >= 0 ? reportedTokens : 0,
  };
}

export async function createKnowledgeEmbeddings(inputs: readonly string[]) {
  return (await createKnowledgeEmbeddingsWithUsage(inputs)).embeddings;
}
