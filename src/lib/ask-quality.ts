export type AskOutcome =
  | "legacy"
  | "answered"
  | "no_evidence"
  | "provider_error"
  | "verification_error";

export type AskUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  embeddingTokens: number;
  estimatedCostUsd: number | null;
};

type RawResponseUsage = {
  input_tokens?: unknown;
  output_tokens?: unknown;
  input_tokens_details?: {
    cached_tokens?: unknown;
    cache_write_tokens?: unknown;
  } | null;
};

type ModelPrice = {
  input: number;
  cachedInput: number;
  output: number;
};

// USD per one million tokens. Keep this registry small and explicit so an
// unknown or newly configured model produces a null estimate, never a false
// cost number.
const RESPONSE_MODEL_PRICES: Record<string, ModelPrice> = {
  "gpt-5.6-sol": { input: 5, cachedInput: 0.5, output: 30 },
  "gpt-5.6-terra": { input: 2.5, cachedInput: 0.25, output: 15 },
  "gpt-5.6-luna": { input: 1, cachedInput: 0.1, output: 6 },
};

const EMBEDDING_MODEL_PRICES: Record<string, number> = {
  "text-embedding-3-large": 0.13,
  "text-embedding-3-small": 0.02,
};

export function emptyAskUsage(): AskUsage {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 0,
    embeddingTokens: 0,
    estimatedCostUsd: 0,
  };
}

function nonNegativeInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function addKnownCost(current: number | null, next: number | null) {
  if (current === null || next === null) return null;
  return current + next;
}

export function addResponseUsage(
  current: AskUsage,
  model: string,
  raw: RawResponseUsage | null | undefined
): AskUsage {
  const inputTokens = nonNegativeInteger(raw?.input_tokens);
  const outputTokens = nonNegativeInteger(raw?.output_tokens);
  const cachedInputTokens = Math.min(
    inputTokens,
    nonNegativeInteger(raw?.input_tokens_details?.cached_tokens)
  );
  const cacheWriteInputTokens = Math.min(
    inputTokens - cachedInputTokens,
    nonNegativeInteger(raw?.input_tokens_details?.cache_write_tokens)
  );
  const regularInputTokens = Math.max(
    0,
    inputTokens - cachedInputTokens - cacheWriteInputTokens
  );
  const price = RESPONSE_MODEL_PRICES[model];
  const requestCost = price
    ? (regularInputTokens * price.input +
        cachedInputTokens * price.cachedInput +
        cacheWriteInputTokens * price.input * 1.25 +
        outputTokens * price.output) /
      1_000_000
    : null;

  return {
    ...current,
    inputTokens: current.inputTokens + inputTokens,
    cachedInputTokens: current.cachedInputTokens + cachedInputTokens,
    cacheWriteInputTokens: current.cacheWriteInputTokens + cacheWriteInputTokens,
    outputTokens: current.outputTokens + outputTokens,
    estimatedCostUsd: addKnownCost(current.estimatedCostUsd, requestCost),
  };
}

export function addEmbeddingUsage(
  current: AskUsage,
  model: string,
  tokens: unknown
): AskUsage {
  const embeddingTokens = nonNegativeInteger(tokens);
  const price = EMBEDDING_MODEL_PRICES[model];
  const requestCost = price ? (embeddingTokens * price) / 1_000_000 : null;
  return {
    ...current,
    embeddingTokens: current.embeddingTokens + embeddingTokens,
    estimatedCostUsd: addKnownCost(current.estimatedCostUsd, requestCost),
  };
}

export type AskOperationalMetrics = {
  sampleSize: number;
  answeredCount: number;
  groundedAnswerRate: number;
  failureRate: number;
  p95LatencyMs: number | null;
  averageCostUsd: number | null;
  feedbackCount: number;
  helpfulFeedbackRate: number | null;
};

export const ASK_OPERATIONAL_GATES = {
  minSampleSize: 20,
  minAnsweredSampleSize: 10,
  minGroundedAnswerRate: 0.98,
  maxFailureRate: 0.02,
  maxP95LatencyMs: 12_000,
  maxAverageCostUsd: 0.08,
  minFeedbackSampleSize: 10,
  minHelpfulFeedbackRate: 0.8,
} as const;

export function checkAskOperationalGates(metrics: AskOperationalMetrics) {
  const failures: string[] = [];
  const warnings: string[] = [];
  const sufficientTraffic = metrics.sampleSize >= ASK_OPERATIONAL_GATES.minSampleSize;
  const sufficientAnswers =
    metrics.answeredCount >= ASK_OPERATIONAL_GATES.minAnsweredSampleSize;
  const sufficientFeedback =
    metrics.feedbackCount >= ASK_OPERATIONAL_GATES.minFeedbackSampleSize;
  const completeOperationalData =
    metrics.p95LatencyMs !== null && metrics.averageCostUsd !== null;

  if (!sufficientTraffic) {
    warnings.push(
      `Collect at least ${ASK_OPERATIONAL_GATES.minSampleSize} production user questions.`
    );
  }
  if (!sufficientAnswers) {
    warnings.push(
      `Collect at least ${ASK_OPERATIONAL_GATES.minAnsweredSampleSize} grounded-answer opportunities.`
    );
  } else {
    if (metrics.groundedAnswerRate < ASK_OPERATIONAL_GATES.minGroundedAnswerRate) {
      failures.push("grounded-answer rate");
    }
  }
  if (sufficientTraffic) {
    if (metrics.failureRate > ASK_OPERATIONAL_GATES.maxFailureRate) {
      failures.push("answer failure rate");
    }
    if (
      metrics.p95LatencyMs !== null &&
      metrics.p95LatencyMs > ASK_OPERATIONAL_GATES.maxP95LatencyMs
    ) {
      failures.push("p95 latency");
    }
    if (
      metrics.averageCostUsd !== null &&
      metrics.averageCostUsd > ASK_OPERATIONAL_GATES.maxAverageCostUsd
    ) {
      failures.push("average cost per question");
    }
  }

  if (metrics.p95LatencyMs === null) warnings.push("Latency telemetry is incomplete.");
  if (metrics.averageCostUsd === null) warnings.push("Cost telemetry is incomplete.");

  if (!sufficientFeedback) {
    warnings.push(
      `Collect at least ${ASK_OPERATIONAL_GATES.minFeedbackSampleSize} answer ratings.`
    );
  } else if (
    metrics.helpfulFeedbackRate !== null &&
    metrics.helpfulFeedbackRate < ASK_OPERATIONAL_GATES.minHelpfulFeedbackRate
  ) {
    failures.push("helpful-feedback rate");
  }

  return {
    status:
      !sufficientTraffic || !sufficientAnswers || !sufficientFeedback || !completeOperationalData
        ? "collecting"
        : failures.length
          ? "failing"
          : "passing",
    failures,
    warnings,
  } as const;
}
