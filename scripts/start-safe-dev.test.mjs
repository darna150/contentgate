import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { assertSafeDevEnvironment } from "./start-safe-dev.mjs";

const staging = {
  environment: "staging",
  supabaseUrl: "https://staging-ref.supabase.co",
  expectedProjectRef: "staging-ref",
};

test("the default dev command always passes through the safety guard", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8")
  );
  assert.equal(packageJson.scripts.dev, "node scripts/start-safe-dev.mjs");
});

test("allows env-free, local development, and a project-bound staging target", () => {
  assert.deepEqual(assertSafeDevEnvironment({}), {
    mode: "unconfigured",
    projectRef: null,
  });
  assert.deepEqual(
    assertSafeDevEnvironment({
      environment: "development",
      supabaseUrl: "http://127.0.0.1:54321",
    }),
    { mode: "development", projectRef: null }
  );
  assert.deepEqual(assertSafeDevEnvironment(staging), {
    mode: "staging",
    projectRef: "staging-ref",
  });
});

test("fails closed for unknown or mismatched configured targets", () => {
  assert.throws(
    () => assertSafeDevEnvironment({ supabaseUrl: staging.supabaseUrl }),
    /CONTENTGATE_ENVIRONMENT must explicitly/
  );
  assert.throws(
    () => assertSafeDevEnvironment({ ...staging, expectedProjectRef: undefined }),
    /must bind the checkout/
  );
  assert.throws(
    () => assertSafeDevEnvironment({ ...staging, expectedProjectRef: "another-ref" }),
    /Supabase URL resolves to staging-ref/
  );
  assert.throws(
    () =>
      assertSafeDevEnvironment({
        environment: "staging",
        supabaseUrl: "https://example.com",
      }),
    /not a recognized Supabase/
  );
});

test("blocks production unless the explicit local override phrase is present", () => {
  const production = {
    environment: "production",
    supabaseUrl: "https://production-ref.supabase.co",
    expectedProjectRef: "production-ref",
  };
  assert.throws(
    () => assertSafeDevEnvironment(production),
    /Refusing local dev against production/
  );
  assert.equal(
    assertSafeDevEnvironment({
      ...production,
      allowProduction: "I_UNDERSTAND_THIS_CONNECTS_TO_PRODUCTION",
    }).mode,
    "production"
  );
});
