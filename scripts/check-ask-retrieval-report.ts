import { readFile } from "node:fs/promises";
import { checkAskReleaseGates } from "../src/lib/ask-release-gates";

const LEXICAL_BASELINE = {
  minSeedRecallAt5: 0.58,
  minAnswerContextRecall: 0.58,
  maxForbiddenHitRate: 0,
} as const;

async function main() {
  const reportPath = process.argv[2];
  if (!reportPath) throw new Error("Pass the Ask retrieval report path.");

  const report = JSON.parse(await readFile(reportPath, "utf8")) as {
    evaluator?: string;
    seed_retrieval?: { recall_at_k?: number; forbidden_hit_rate?: number };
    answer_context?: { recall_at_k?: number; forbidden_hit_rate?: number };
  };
  const metrics = {
    seedRecallAt5: Number(report.seed_retrieval?.recall_at_k ?? 0),
    answerContextRecall: Number(report.answer_context?.recall_at_k ?? 0),
    forbiddenHitRate: Math.max(
      Number(report.seed_retrieval?.forbidden_hit_rate ?? 0),
      Number(report.answer_context?.forbidden_hit_rate ?? 0)
    ),
    // Live latency and cost are evaluated from production telemetry. This check
    // intentionally gates the scheduled offline retrieval dimensions only.
    p95LatencyMs: 0,
    estimatedCostPerAnswerUsd: 0,
  };
  const result = report.evaluator === "lexical-fallback-baseline"
    ? (() => {
        const failures: string[] = [];
        if (metrics.seedRecallAt5 < LEXICAL_BASELINE.minSeedRecallAt5) {
          failures.push("lexical seed Recall@5 regression");
        }
        if (metrics.answerContextRecall < LEXICAL_BASELINE.minAnswerContextRecall) {
          failures.push("lexical answer-context recall regression");
        }
        if (metrics.forbiddenHitRate > LEXICAL_BASELINE.maxForbiddenHitRate) {
          failures.push("forbidden-source hit rate");
        }
        return { passed: failures.length === 0, failures };
      })()
    : checkAskReleaseGates(metrics);
  console.log(JSON.stringify({ metrics, ...result }, null, 2));
  if (!result.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Ask report check failed.");
  process.exitCode = 1;
});
