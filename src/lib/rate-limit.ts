import type { SupabaseClient } from "@supabase/supabase-js";

export type ApiRateLimitScope =
  | "content.generate"
  | "knowledge.ask"
  | "legacy.generate";

export type ApiRateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

type RawRateLimitRow = {
  allowed?: unknown;
  request_limit?: unknown;
  remaining?: unknown;
  retry_after_seconds?: unknown;
};

export function normalizeRateLimitResult(data: unknown): ApiRateLimitResult {
  const row = (Array.isArray(data) ? data[0] : data) as RawRateLimitRow | null;
  if (
    !row ||
    typeof row.allowed !== "boolean" ||
    typeof row.request_limit !== "number" ||
    typeof row.remaining !== "number" ||
    typeof row.retry_after_seconds !== "number"
  ) {
    throw new Error("Rate limit service returned an invalid response.");
  }

  return {
    allowed: row.allowed,
    limit: row.request_limit,
    remaining: row.remaining,
    retryAfterSeconds: Math.max(1, row.retry_after_seconds),
  };
}

export async function consumeApiRateLimit(
  supabase: SupabaseClient,
  scope: ApiRateLimitScope
): Promise<ApiRateLimitResult> {
  const { data, error } = await supabase.rpc("consume_api_rate_limit", {
    p_scope: scope,
  });
  if (error) throw new Error(`Rate limit check failed: ${error.message}`);
  return normalizeRateLimitResult(data);
}

export function rateLimitResponse(result: ApiRateLimitResult) {
  const minutes = Math.floor(result.retryAfterSeconds / 60);
  const seconds = result.retryAfterSeconds % 60;
  const wait =
    minutes > 0
      ? `${minutes}m${seconds > 0 ? ` ${seconds}s` : ""}`
      : `${seconds}s`;

  return Response.json(
    {
      error: `Generation limit reached. Try again in ${wait}.`,
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    }
  );
}
