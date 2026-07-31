import assert from "node:assert/strict";
import test from "node:test";
import {
  getAuthConfirmationDestination,
  getAuthConfirmationPath,
  isEmailOtpType,
} from "./auth-confirm.ts";

test("accepts supported email OTP types", () => {
  assert.equal(isEmailOtpType("recovery"), true);
  assert.equal(isEmailOtpType("invite"), true);
  assert.equal(isEmailOtpType("not-a-real-type"), false);
  assert.equal(isEmailOtpType(null), false);
});

test("uses flow-specific destinations", () => {
  assert.equal(getAuthConfirmationDestination(null, "recovery"), "/reset-password");
  assert.equal(getAuthConfirmationDestination(null, "invite"), "/welcome");
  assert.equal(getAuthConfirmationDestination(null, "email"), "/dashboard");
});

test("accepts only same-origin relative destinations", () => {
  assert.equal(
    getAuthConfirmationDestination("/reset-password", "recovery"),
    "/reset-password"
  );
  assert.equal(
    getAuthConfirmationDestination("https://attacker.example", "recovery"),
    "/reset-password"
  );
  assert.equal(
    getAuthConfirmationDestination("//attacker.example", "recovery"),
    "/reset-password"
  );
});

test("forwards token links through the verification route", () => {
  assert.equal(
    getAuthConfirmationPath("fresh-token", "recovery", "/reset-password"),
    "/auth/confirm?token_hash=fresh-token&type=recovery&next=%2Freset-password"
  );
  assert.equal(getAuthConfirmationPath("", "recovery", null), null);
  assert.equal(getAuthConfirmationPath("fresh-token", "unsupported", null), null);
});
