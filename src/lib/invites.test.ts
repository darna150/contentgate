import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INVITABLE_ROLES,
  isInvitableRole,
  normalizeInviteEmail,
} from "./invites.ts";

describe("normalizeInviteEmail", () => {
  it("lowercases and trims, matching the provisioning constraint", () => {
    assert.equal(normalizeInviteEmail("  Vet@Clinic.Example  "), "vet@clinic.example");
  });

  it("accepts a plain valid address", () => {
    assert.equal(normalizeInviteEmail("a.b+tag@example.co"), "a.b+tag@example.co");
  });

  it("rejects malformed addresses", () => {
    for (const bad of [
      "",
      "   ",
      "no-at-sign.example.com",
      "@example.com",
      "two@@example.com",
      "space in@example.com",
      "user@nodot",
      "user@.leading.dot",
      "user@trailing.dot.",
      null,
      undefined,
      42,
    ]) {
      assert.equal(normalizeInviteEmail(bad), null, `expected rejection: ${String(bad)}`);
    }
  });
});

describe("isInvitableRole", () => {
  it("accepts exactly the three app roles", () => {
    assert.deepEqual([...INVITABLE_ROLES], ["member", "approver", "admin"]);
    for (const role of INVITABLE_ROLES) assert.ok(isInvitableRole(role));
  });

  it("rejects anything else", () => {
    for (const bad of ["owner", "superadmin", "", null, undefined, 1]) {
      assert.ok(!isInvitableRole(bad), `expected rejection: ${String(bad)}`);
    }
  });
});
