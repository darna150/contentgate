export type AskReleaseMetrics = {
  seedRecallAt5: number;
  answerContextRecall: number;
  forbiddenHitRate: number;
  p95LatencyMs: number;
  estimatedCostPerAnswerUsd: number;
};

export const ASK_RELEASE_GATES = {
  minSeedRecallAt5: 0.9,
  minAnswerContextRecall: 0.98,
  maxForbiddenHitRate: 0,
  maxP95LatencyMs: 12_000,
  maxEstimatedCostPerAnswerUsd: 0.08,
} as const;

export function checkAskReleaseGates(metrics: AskReleaseMetrics) {
  const failures: string[] = [];
  if (metrics.seedRecallAt5 < ASK_RELEASE_GATES.minSeedRecallAt5) failures.push("seed Recall@5");
  if (metrics.answerContextRecall < ASK_RELEASE_GATES.minAnswerContextRecall) {
    failures.push("answer-context recall");
  }
  if (metrics.forbiddenHitRate > ASK_RELEASE_GATES.maxForbiddenHitRate) {
    failures.push("forbidden-source hit rate");
  }
  if (metrics.p95LatencyMs > ASK_RELEASE_GATES.maxP95LatencyMs) failures.push("p95 latency");
  if (metrics.estimatedCostPerAnswerUsd > ASK_RELEASE_GATES.maxEstimatedCostPerAnswerUsd) {
    failures.push("estimated cost per answer");
  }
  return { passed: failures.length === 0, failures };
}
