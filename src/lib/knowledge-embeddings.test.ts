import assert from "node:assert/strict";
import test from "node:test";

import {
  isKnowledgeEmbedding,
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
} from "./knowledge-embedding-contract.ts";

test("knowledge embeddings require the configured finite vector dimension", () => {
  assert.equal(isKnowledgeEmbedding(new Array(KNOWLEDGE_EMBEDDING_DIMENSIONS).fill(0)), true);
  assert.equal(isKnowledgeEmbedding([0, 1]), false);
  assert.equal(
    isKnowledgeEmbedding([...new Array(KNOWLEDGE_EMBEDDING_DIMENSIONS - 1).fill(0), Number.NaN]),
    false
  );
});
