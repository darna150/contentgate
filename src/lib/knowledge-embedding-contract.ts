export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 1536;

export function isKnowledgeEmbedding(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === KNOWLEDGE_EMBEDDING_DIMENSIONS &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}
