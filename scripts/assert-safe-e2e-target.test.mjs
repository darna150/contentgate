import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSafeE2ETarget,
  isProductionHost,
} from "./assert-safe-e2e-target.mjs";

test("blocks every known ContentGate production hostname", () => {
  for (const hostname of [
    "contentgate.app",
    "www.contentgate.app",
    "api.contentgate.app",
    "contentgate-delta.vercel.app",
  ]) {
    assert.equal(isProductionHost(hostname), true);
    assert.throws(
      () => assertSafeE2ETarget(`https://${hostname}`),
      /Refusing stateful E2E against production/
    );
  }
});

test("allows Vercel previews and local development", () => {
  assert.equal(
    assertSafeE2ETarget(
      "https://contentgate-git-release-example.vercel.app/some/path"
    ),
    "https://contentgate-git-release-example.vercel.app"
  );
  assert.equal(
    assertSafeE2ETarget("http://localhost:3000"),
    "http://localhost:3000"
  );
});

test("rejects malformed, credentialed, or insecure remote targets", () => {
  assert.throws(() => assertSafeE2ETarget("not a URL"), /Invalid E2E base URL/);
  assert.throws(
    () => assertSafeE2ETarget("https://user:secret@example.com"),
    /must not contain credentials/
  );
  assert.throws(
    () => assertSafeE2ETarget("http://preview.example.com"),
    /must use HTTPS/
  );
});
