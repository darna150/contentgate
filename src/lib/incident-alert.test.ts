import assert from "node:assert/strict";
import test from "node:test";

import {
  deliverIncidentAlert,
  incidentAlertConfigIssues,
} from "./incident-alert.ts";

const alert = {
  severity: "P1" as const,
  service: "contentgate-health",
  summary: "Health check failed",
  occurredAt: "2026-07-31T00:00:00.000Z",
  environment: "production",
  deployment: "sha-123",
  details: { status: 503 },
};
const webhookToken = "test-incident-token-32-characters-long";

test("incident delivery fails visibly when no route or owner is configured", async () => {
  assert.deepEqual(
    await deliverIncidentAlert(alert, {
      webhookUrl: undefined,
      webhookToken: undefined,
      owner: undefined,
    }),
    { status: "unconfigured" },
  );
});

test("incident readiness requires HTTPS, a strong token, and a named owner", () => {
  assert.deepEqual(
    incidentAlertConfigIssues({
      webhookUrl: undefined,
      webhookToken: undefined,
      owner: undefined,
    }),
    [
      "CONTENTGATE_INCIDENT_WEBHOOK_URL",
      "CONTENTGATE_INCIDENT_WEBHOOK_TOKEN",
      "CONTENTGATE_INCIDENT_OWNER",
    ],
  );
  assert.deepEqual(
    incidentAlertConfigIssues({
      webhookUrl: "http://incident.example.test/contentgate",
      webhookToken: "short",
      owner: " ",
    }),
    [
      "CONTENTGATE_INCIDENT_WEBHOOK_URL",
      "CONTENTGATE_INCIDENT_WEBHOOK_TOKEN",
      "CONTENTGATE_INCIDENT_OWNER",
    ],
  );
  assert.deepEqual(
    incidentAlertConfigIssues({
      webhookUrl: "https://incident.example.test/contentgate",
      webhookToken: "a".repeat(32),
      owner: "engineering-primary",
    }),
    [],
  );
  assert.deepEqual(
    incidentAlertConfigIssues({
      webhookUrl: "https://user:password@localhost/contentgate",
      webhookToken: "a".repeat(32),
      owner: "engineering-primary",
    }),
    ["CONTENTGATE_INCIDENT_WEBHOOK_URL"],
  );
});

test("incident delivery uses a bounded authenticated HTTPS webhook", async () => {
  let request: RequestInit | undefined;
  const result = await deliverIncidentAlert(
    alert,
    {
      webhookUrl: "https://incident.example.test/contentgate",
      webhookToken,
      owner: "engineering-primary",
    },
    async (_url, init) => {
      request = init;
      return new Response(null, { status: 202 });
    },
  );
  assert.deepEqual(result, { status: "delivered" });
  assert.equal((request?.headers as Record<string, string>).Authorization, `Bearer ${webhookToken}`);
  assert.match(String(request?.body), /engineering-primary/);
  assert.ok(request?.signal, "webhook request must have a timeout signal");
});

test("incident delivery rejects insecure endpoints and non-success responses", async () => {
  assert.deepEqual(
    await deliverIncidentAlert(alert, {
      webhookUrl: "http://incident.example.test/contentgate",
      webhookToken,
      owner: "engineering-primary",
    }),
    { status: "unconfigured" },
  );
  await assert.rejects(
    deliverIncidentAlert(
      alert,
      {
        webhookUrl: "https://incident.example.test/contentgate",
        webhookToken,
        owner: "engineering-primary",
      },
      async () => new Response(null, { status: 503 }),
    ),
    /returned 503/,
  );
});
