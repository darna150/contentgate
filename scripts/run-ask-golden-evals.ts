import { loadEnvConfig } from "@next/env";
import {
  ASK_GOLDEN_DOCUMENTS,
  ASK_GOLDEN_EVAL_CASES,
  approvedGoldenEvidence,
  scoreAskGoldenRetrieval,
} from "../src/lib/ask-golden-evals";
import {
  buildContextualEmbeddingInputs,
  expandKnowledgeEvidenceWithNeighbors,
} from "../src/lib/knowledge-chunking";
import { buildAskRetrievalQueries, fuseAskRetrievalEvidence } from "../src/lib/ask-retrieval";
import { rankKnowledgeEvidence } from "../src/lib/knowledge-reliability";

loadEnvConfig(process.cwd());

const corpus = approvedGoldenEvidence();

function cosineSimilarity(left: readonly number[], right: readonly number[]) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

async function embed(inputs: readonly string[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for --hybrid evaluation.");
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_KNOWLEDGE_EMBEDDING_MODEL ?? "text-embedding-3-large",
      input: inputs,
      dimensions: 1_536,
      encoding_format: "float",
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`OpenAI embeddings failed (${response.status}).`);
  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const vectors = payload.data?.map((item) => item.embedding ?? []) ?? [];
  if (vectors.length !== inputs.length || vectors.some((vector) => vector.length !== 1_536)) {
    throw new Error("OpenAI returned an invalid evaluation embedding payload.");
  }
  return vectors;
}

function contextualCorpusInputs() {
  const byKey = new Map<string, string>();
  for (const document of ASK_GOLDEN_DOCUMENTS) {
    if (document.approvalStatus !== "approved" || document.productId !== "product-a") continue;
    const inputs = buildContextualEmbeddingInputs(document.title, document.paragraphs);
    document.paragraphs.forEach((paragraph, index) => {
      byKey.set(`${document.id}:${paragraph.n}`, inputs[index]);
    });
  }
  return corpus.map(
    (paragraph) =>
      byKey.get(`${paragraph.document_id}:${paragraph.paragraph_n}`) ??
      `${paragraph.document_title}\n${paragraph.paragraph_text}`
  );
}

function reciprocalRankFuse(
  lexical: typeof corpus,
  semantic: typeof corpus,
  limit = 5
) {
  const scores = new Map<string, number>();
  const evidence = new Map(
    corpus.map((paragraph) => [
      `${paragraph.document_id}:${paragraph.paragraph_n}`,
      paragraph,
    ])
  );
  for (const [index, paragraph] of lexical.entries()) {
    const key = `${paragraph.document_id}:${paragraph.paragraph_n}`;
    scores.set(key, (scores.get(key) ?? 0) + 1 / (50 + index + 1));
  }
  for (const [index, paragraph] of semantic.entries()) {
    const key = `${paragraph.document_id}:${paragraph.paragraph_n}`;
    scores.set(key, (scores.get(key) ?? 0) + 1 / (50 + index + 1));
  }
  return [...scores.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .flatMap(([key, relevance]) => {
      const paragraph = evidence.get(key);
      return paragraph ? [{ ...paragraph, relevance }] : [];
    });
}

async function main() {
  const hybrid = process.argv.includes("--hybrid");
  let results: Record<string, typeof corpus>;

  if (hybrid) {
    const corpusInputs = contextualCorpusInputs();
    const retrievalQueries = ASK_GOLDEN_EVAL_CASES.map((testCase) =>
      buildAskRetrievalQueries(testCase.question)
    );
    const vectors = await embed([
      ...corpusInputs,
      ...retrievalQueries.flat(),
    ]);
    const corpusVectors = vectors.slice(0, corpus.length);
    let vectorOffset = corpus.length;
    results = Object.fromEntries(
      ASK_GOLDEN_EVAL_CASES.map((testCase, caseIndex) => {
        const groups = retrievalQueries[caseIndex].map((query) => {
          const queryVector = vectors[vectorOffset++];
          const lexical = rankKnowledgeEvidence(query, corpus, 30);
          const semantic = corpus
            .map((paragraph, paragraphIndex) => ({
              paragraph,
              similarity: cosineSimilarity(corpusVectors[paragraphIndex], queryVector),
            }))
            .sort((left, right) => right.similarity - left.similarity)
            .map((item) => item.paragraph);
          return reciprocalRankFuse(lexical, semantic, 8);
        });
        return [testCase.id, fuseAskRetrievalEvidence(groups, 5)];
      })
    );
  } else {
    results = Object.fromEntries(
      ASK_GOLDEN_EVAL_CASES.map((testCase) => [
        testCase.id,
        fuseAskRetrievalEvidence(
          buildAskRetrievalQueries(testCase.question).map((query) =>
            rankKnowledgeEvidence(query, corpus, 8)
          ),
          5
        ),
      ])
    );
  }
  const contextResults = Object.fromEntries(
    ASK_GOLDEN_EVAL_CASES.map((testCase) => [
      testCase.id,
      expandKnowledgeEvidenceWithNeighbors({
        seeds: results[testCase.id] ?? [],
        corpus,
        radius: 1,
        limit: 18,
      }),
    ])
  );
  const seedScore = scoreAskGoldenRetrieval(results, 5);
  const contextScore = scoreAskGoldenRetrieval(contextResults, 18);

  console.log(
    JSON.stringify(
      {
        evaluator: hybrid ? "contextual-hybrid" : "lexical-fallback-baseline",
        seed_retrieval: { top_k: 5, ...seedScore },
        answer_context: { limit: 18, ...contextScore },
        misses: ASK_GOLDEN_EVAL_CASES.flatMap((testCase) => {
          const retrieved = contextResults[testCase.id] ?? [];
          const retrievedKeys = new Set(
            retrieved.map((item) => `${item.document_id}:${item.paragraph_n}`)
          );
          const missing = testCase.expectedEvidence.filter((key) => !retrievedKeys.has(key));
          return missing.length > 0 ? [{ id: testCase.id, missing }] : [];
        }),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Ask evaluation failed.");
  process.exitCode = 1;
});
