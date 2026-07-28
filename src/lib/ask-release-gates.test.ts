import assert from "node:assert/strict";
import test from "node:test";

import { checkAskReleaseGates } from "./ask-release-gates.ts";

test("Ask release gates require quality, safety, latency, and cost budgets", () => {
  assert.deepEqual(
    checkAskReleaseGates({
      seedRecallAt5: 0.917,
      answerContextRecall: 1,
      forbiddenHitRate: 0,
      p95LatencyMs: 9_000,
      estimatedCostPerAnswerUsd: 0.04,
    }),
    { passed: true, failures: [] }
  );
  assert.equal(
    checkAskReleaseGates({
      seedRecallAt5: 0.5,
      answerContextRecall: 0.5,
      forbiddenHitRate: 0.1,
      p95LatencyMs: 20_000,
      estimatedCostPerAnswerUsd: 1,
    }).passed,
    false
  );
});
