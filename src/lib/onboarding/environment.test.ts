import assert from "node:assert/strict";
import test from "node:test";

import {
  checkOnboardingEnvironment,
  isPlatformOperator,
  productionConfirmation,
  supabaseProjectRef,
} from "./environment.ts";

test("extracts a hosted Supabase project reference", () => {
  assert.equal(supabaseProjectRef("https://abcdefghijkl.supabase.co"), "abcdefghijkl");
});

test("blocks a project mismatch", () => {
  const result = checkOnboardingEnvironment({
    target: "staging",
    supabaseUrl: "https://stagingref.supabase.co",
    expectedProjectRef: "productionref",
    allowProduction: undefined,
    workspaceKey: "acme-health",
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /project mismatch/i);
});

test("production needs both a feature gate and exact per-workspace confirmation", () => {
  const base = {
    target: "production",
    supabaseUrl: "https://productionref.supabase.co",
    expectedProjectRef: "productionref",
    workspaceKey: "acme-health",
  };
  assert.equal(checkOnboardingEnvironment({ ...base, allowProduction: undefined }).ok, false);
  assert.equal(
    checkOnboardingEnvironment({
      ...base,
      allowProduction: "true",
      confirmation: productionConfirmation("acme-health"),
    }).ok,
    true,
  );
});

test("platform operator allowlist is case-insensitive and exact", () => {
  assert.equal(isPlatformOperator("CEO@EXAMPLE.COM", "ceo@example.com, qa@example.com"), true);
  assert.equal(isPlatformOperator("attacker@example.com", "ceo@example.com"), false);
});
