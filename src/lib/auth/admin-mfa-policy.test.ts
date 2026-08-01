import assert from "node:assert/strict";
import test from "node:test";

import { adminMfaSatisfied } from "./admin-mfa-policy.ts";

test("non-admin roles never satisfy the admin MFA policy", () => {
  for (const role of [null, "member", "approver"]) {
    assert.equal(
      adminMfaSatisfied({ role, required: false, currentLevel: "aal2" }),
      false
    );
  }
});

test("an existing opt-in workspace permits its admin until enforcement is enabled", () => {
  assert.equal(
    adminMfaSatisfied({ role: "admin", required: false, currentLevel: "aal1" }),
    true
  );
});

test("a required workspace fails closed unless the session is AAL2", () => {
  assert.equal(
    adminMfaSatisfied({ role: "admin", required: true, currentLevel: "aal1" }),
    false
  );
  assert.equal(
    adminMfaSatisfied({ role: "admin", required: true, currentLevel: null }),
    false
  );
  assert.equal(
    adminMfaSatisfied({ role: "admin", required: true, currentLevel: "aal2" }),
    true
  );
});

test("cross-tenant operations can require AAL2 before workspace opt-in", () => {
  assert.equal(
    adminMfaSatisfied({
      role: "admin",
      required: false,
      currentLevel: "aal1",
      alwaysRequireAal2: true,
    }),
    false
  );
});
