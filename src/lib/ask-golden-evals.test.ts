import assert from "node:assert/strict";
import test from "node:test";

import {
  ASK_GOLDEN_EVAL_CASES,
  approvedGoldenEvidence,
  scoreAskGoldenRetrieval,
  validateAskGoldenCorpus,
} from "./ask-golden-evals.ts";

test("golden Ask corpus is valid, diverse, and excludes inactive or other-product evidence", () => {
  assert.equal(validateAskGoldenCorpus(), true);
  assert.ok(ASK_GOLDEN_EVAL_CASES.length >= 12);
  assert.ok(new Set(ASK_GOLDEN_EVAL_CASES.map((item) => item.category)).size >= 10);

  const evidenceKeys = approvedGoldenEvidence().map(
    (paragraph) => `${paragraph.document_id}:${paragraph.paragraph_n}`
  );
  assert.equal(evidenceKeys.some((key) => key.startsWith("gold-usage-old:")), false);
  assert.equal(evidenceKeys.some((key) => key.startsWith("gold-other-product:")), false);
});

test("golden retrieval scorecard measures recall, rank, and forbidden evidence", () => {
  const evidence = approvedGoldenEvidence();
  const byKey = new Map(
    evidence.map((paragraph) => [
      `${paragraph.document_id}:${paragraph.paragraph_n}`,
      paragraph,
    ])
  );
  const perfectResults = Object.fromEntries(
    ASK_GOLDEN_EVAL_CASES.map((testCase) => [
      testCase.id,
      testCase.expectedEvidence.flatMap((key) => {
        const paragraph = byKey.get(key);
        return paragraph ? [paragraph] : [];
      }),
    ])
  );

  assert.deepEqual(scoreAskGoldenRetrieval(perfectResults), {
    cases: 12,
    answerable_cases: 11,
    recall_at_k: 1,
    mean_reciprocal_rank: 1,
    forbidden_hit_rate: 0,
  });
});
