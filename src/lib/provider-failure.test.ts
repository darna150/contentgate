import assert from "node:assert/strict";
import test from "node:test";

import {
  isSyntheticProviderFailureRequest,
  reportProviderIncident,
} from "./provider-failure.ts";

const incident = {
  severity: "P1" as const,
  service: "contentgate-generation",
  summary: "Generation provider retries exhausted",
  occurredAt: "2026-07-31T00:00:00.000Z",
  environment: "staging",
  deployment: "abc123",
  details: { route: "/api/products/generate", attempts: 4 },
};

test("provider failure injection is limited to synthetic staging identities", () => {
  const request = new Request("https://preview.example.test/api/products/generate", {
    headers: { "x-contentgate-validation-run": "provider-failure" },
  });
  const preview = {
    CONTENTGATE_ENVIRONMENT: "staging",
    CONTENTGATE_SUPABASE_PROJECT_REF: "bncwjibscptgijgmuhrn",
    VERCEL_ENV: "preview",
  };

  assert.equal(
    isSyntheticProviderFailureRequest(
      request,
      "enterprise-provider-failure-a1b2c3d4@contentgate.example",
      preview,
    ),
    true,
  );
  assert.equal(isSyntheticProviderFailureRequest(request, "person@example.com", preview), false);
  assert.equal(
    isSyntheticProviderFailureRequest(
      request,
      "enterprise-provider-failure-a1b2c3d4@contentgate.example",
      { ...preview, CONTENTGATE_SUPABASE_PROJECT_REF: "egjssfcenboalijfdmsi" },
    ),
    false,
  );
  assert.equal(
    isSyntheticProviderFailureRequest(
      request,
      "enterprise-provider-failure-a1b2c3d4@contentgate.example",
      { CONTENTGATE_ENVIRONMENT: "production", VERCEL_ENV: "production" },
    ),
    false,
  );
  assert.equal(
    isSyntheticProviderFailureRequest(
      new Request(request.url),
      "enterprise-provider-failure-a1b2c3d4@contentgate.example",
      preview,
    ),
    false,
  );
});

test("provider incidents report delivery without leaking the bearer token", async () => {
  const messages: string[] = [];
  let authorization: string | null = null;
  const outcome = await reportProviderIncident(incident, {
    config: {
      webhookUrl: "https://incident.example.test/contentgate",
      webhookToken: "top-secret-token",
      owner: "release-primary",
    },
    fetchImplementation: async (_url, init) => {
      authorization = new Headers(init?.headers).get("authorization");
      return new Response(null, { status: 202 });
    },
    log: {
      error: (message) => messages.push(String(message)),
      info: (message) => messages.push(String(message)),
    },
  });

  assert.equal(outcome, "delivered");
  assert.equal(authorization, "Bearer top-secret-token");
  assert.equal(messages.some((message) => message.includes("top-secret-token")), false);
  assert.match(messages.join("\n"), /provider\.incident_delivered/);
});

test("provider incident reporting distinguishes unconfigured and failed delivery", async () => {
  const messages: string[] = [];
  const log = {
    error: (message: unknown) => messages.push(String(message)),
    info: (message: unknown) => messages.push(String(message)),
  };
  assert.equal(
    await reportProviderIncident(incident, {
      config: { webhookUrl: undefined, webhookToken: undefined, owner: undefined },
      log,
    }),
    "unconfigured",
  );
  assert.equal(
    await reportProviderIncident(incident, {
      config: {
        webhookUrl: "https://incident.example.test/contentgate",
        webhookToken: "token",
        owner: "release-primary",
      },
      fetchImplementation: async () => new Response(null, { status: 503 }),
      log,
    }),
    "failed",
  );
  assert.match(messages.join("\n"), /provider\.incident_unconfigured/);
  assert.match(messages.join("\n"), /provider\.incident_delivery_failed/);
});
