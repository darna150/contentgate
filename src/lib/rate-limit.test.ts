import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRateLimitResult, rateLimitResponse } from "./rate-limit.ts";

test("normalizes the database rate-limit response", () => {
  assert.deepEqual(
    normalizeRateLimitResult([
      {
        allowed: true,
        request_limit: 10,
        remaining: 7,
        retry_after_seconds: 42,
      },
    ]),
    { allowed: true, limit: 10, remaining: 7, retryAfterSeconds: 42 }
  );
});

test("returns standard 429 headers when the limit is exceeded", async () => {
  const response = rateLimitResponse({
    allowed: false,
    limit: 5,
    remaining: 0,
    retryAfterSeconds: 90,
  });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "90");
  assert.deepEqual(await response.json(), {
    error: "Too many requests. Try again shortly.",
  });
});

test("rejects malformed database responses", () => {
  assert.throws(() => normalizeRateLimitResult([]), /invalid response/);
});
