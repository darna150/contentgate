import assert from "node:assert/strict";
import test from "node:test";

import {
  addEmbeddingUsage,
  addResponseUsage,
  checkAskOperationalGates,
  emptyAskUsage,
} from "./ask-quality.ts";

test("Ask usage measures cached, cache-write, output, and embedding cost", () => {
  const responseUsage = addResponseUsage(emptyAskUsage(), "gpt-5.6-sol", {
    input_tokens: 1_000,
    output_tokens: 100,
    input_tokens_details: { cached_tokens: 200, cache_write_tokens: 100 },
  });
  const usage = addEmbeddingUsage(responseUsage, "text-embedding-3-large", 1_000);

  assert.deepEqual(
    {
      inputTokens: usage.inputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      cacheWriteInputTokens: usage.cacheWriteInputTokens,
      outputTokens: usage.outputTokens,
      embeddingTokens: usage.embeddingTokens,
    },
    {
      inputTokens: 1_000,
      cachedInputTokens: 200,
      cacheWriteInputTokens: 100,
      outputTokens: 100,
      embeddingTokens: 1_000,
    }
  );
  assert.ok(Math.abs((usage.estimatedCostUsd ?? 0) - 0.007355) < 1e-12);
});

test("Ask cost fails closed when a configured model has no known price", () => {
  const usage = addResponseUsage(emptyAskUsage(), "future-model", {
    input_tokens: 10,
    output_tokens: 5,
  });
  assert.equal(usage.estimatedCostUsd, null);
});

test("operational gates distinguish collecting, passing, and failing baselines", () => {
  const collecting = checkAskOperationalGates({
    sampleSize: 5,
    answeredCount: 2,
    groundedAnswerRate: 1,
    failureRate: 0,
    p95LatencyMs: 5_000,
    averageCostUsd: 0.02,
    feedbackCount: 0,
    helpfulFeedbackRate: null,
  });
  assert.equal(collecting.status, "collecting");
  assert.equal(collecting.warnings.length, 3);

  const incompleteMeasurement = checkAskOperationalGates({
    sampleSize: 30,
    answeredCount: 0,
    groundedAnswerRate: 1,
    failureRate: 0,
    p95LatencyMs: null,
    averageCostUsd: null,
    feedbackCount: 0,
    helpfulFeedbackRate: null,
  });
  assert.equal(incompleteMeasurement.status, "collecting");
  assert.ok(incompleteMeasurement.warnings.includes("Cost telemetry is incomplete."));

  const passing = checkAskOperationalGates({
    sampleSize: 30,
    answeredCount: 20,
    groundedAnswerRate: 1,
    failureRate: 0,
    p95LatencyMs: 8_000,
    averageCostUsd: 0.03,
    feedbackCount: 10,
    helpfulFeedbackRate: 0.9,
  });
  assert.equal(passing.status, "passing");

  const failing = checkAskOperationalGates({
    sampleSize: 30,
    answeredCount: 20,
    groundedAnswerRate: 0.8,
    failureRate: 0.1,
    p95LatencyMs: 20_000,
    averageCostUsd: 0.2,
    feedbackCount: 10,
    helpfulFeedbackRate: 0.5,
  });
  assert.equal(failing.status, "failing");
  assert.equal(failing.failures.length, 5);
});
