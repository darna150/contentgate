import { checkAskReleaseGates, type AskReleaseMetrics } from "../src/lib/ask-release-gates";

const raw = process.env.ASK_RELEASE_METRICS_JSON;
if (!raw) {
  throw new Error(
    "ASK_RELEASE_METRICS_JSON is required. Supply seedRecallAt5, answerContextRecall, forbiddenHitRate, p95LatencyMs, and estimatedCostPerAnswerUsd."
  );
}

const metrics = JSON.parse(raw) as AskReleaseMetrics;
const result = checkAskReleaseGates(metrics);
console.log(JSON.stringify({ metrics, ...result }, null, 2));
if (!result.passed) process.exitCode = 1;
