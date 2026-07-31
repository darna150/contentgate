import assert from "node:assert/strict";
import test from "node:test";

import {
  buildIncidentEmail,
  incidentEmailConfigIssues,
  incidentEmailIdempotencyKey,
  incidentWebhookAuthorized,
  parseIncidentAlert,
} from "./incident-email.ts";

const token = "test-incident-token-that-is-longer-than-32-characters";
const alert = {
  severity: "P1" as const,
  service: "contentgate-health",
  summary: "Health check failed",
  occurredAt: "2026-08-01T00:00:00.000Z",
  environment: "staging",
  deployment: "sha-123",
  owner: "Debbie Melgarejo",
  details: { status: 503, unsafe: "<script>alert(1)</script>" },
};

test("incident webhook authorization uses the configured bearer token", () => {
  assert.equal(incidentWebhookAuthorized(`Bearer ${token}`, token), true);
  assert.equal(incidentWebhookAuthorized("Bearer wrong", token), false);
  assert.equal(incidentWebhookAuthorized(null, token), false);
  assert.equal(incidentWebhookAuthorized(`Bearer ${token}`, "short"), false);
});

test("incident payload parsing rejects malformed and oversized fields", () => {
  assert.deepEqual(parseIncidentAlert(alert), alert);
  assert.equal(parseIncidentAlert({ ...alert, severity: "P9" }), null);
  assert.equal(parseIncidentAlert({ ...alert, occurredAt: "not-a-date" }), null);
  assert.equal(parseIncidentAlert({ ...alert, summary: "x".repeat(501) }), null);
  assert.equal(parseIncidentAlert({ ...alert, details: [] }), null);
});

test("incident email configuration requires server-side delivery settings", () => {
  assert.deepEqual(
    incidentEmailConfigIssues({ apiKey: undefined, from: undefined, to: undefined, replyTo: undefined }),
    ["RESEND_API_KEY", "CONTENTGATE_INCIDENT_EMAIL_FROM", "CONTENTGATE_INCIDENT_EMAIL_TO"],
  );
  assert.deepEqual(
    incidentEmailConfigIssues({
      apiKey: "re_test_key_that_is_long_enough",
      from: "ContentGate Incidents <incidents@contentgate.app>",
      to: "support@contentgate.app",
      replyTo: "security@contentgate.app",
    }),
    [],
  );
});

test("incident email is escaped, bounded, and idempotent", () => {
  const message = buildIncidentEmail(alert, {
    apiKey: "re_test_key_that_is_long_enough",
    from: "ContentGate Incidents <incidents@contentgate.app>",
    to: "support@contentgate.app",
    replyTo: "security@contentgate.app",
  });
  assert.equal(message.to, "support@contentgate.app");
  assert.equal(message.replyTo, "security@contentgate.app");
  assert.match(message.subject, /^\[ContentGate P1\]/u);
  assert.doesNotMatch(message.html, /<script>/u);
  assert.match(message.html, /&lt;script&gt;/u);
  assert.equal(incidentEmailIdempotencyKey(alert), incidentEmailIdempotencyKey({ ...alert }));
});
