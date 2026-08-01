import { Resend } from "resend";

import {
  buildIncidentEmail,
  incidentEmailConfigFromEnvironment,
  incidentEmailConfigIssues,
  incidentEmailIdempotencyKey,
  incidentWebhookAuthorized,
  parseIncidentAlert,
} from "@/lib/incident-email";

const MAX_REQUEST_BYTES = 64 * 1024;

export async function POST(request: Request) {
  if (
    !incidentWebhookAuthorized(
      request.headers.get("authorization"),
      process.env.CONTENTGATE_INCIDENT_WEBHOOK_TOKEN,
    )
  ) {
    return Response.json(
      { error: "Incident delivery authorization failed." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return Response.json(
      { error: "Incident payload is too large." },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
    return Response.json(
      { error: "Incident payload is too large." },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return Response.json(
      { error: "Incident payload is invalid." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const alert = parseIncidentAlert(parsed);
  if (!alert) {
    return Response.json(
      { error: "Incident payload is invalid." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const config = incidentEmailConfigFromEnvironment();
  if (incidentEmailConfigIssues(config).length > 0 || !config.apiKey) {
    console.error("incident.email_unconfigured", {
      severity: alert.severity,
      service: alert.service,
      environment: alert.environment,
      deployment: alert.deployment,
    });
    return Response.json(
      { error: "Incident email delivery is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const resend = new Resend(config.apiKey);
    const message = buildIncidentEmail(alert, config);
    const { data, error } = await resend.emails.send(message, {
      idempotencyKey: incidentEmailIdempotencyKey(alert),
    });
    if (error) throw new Error(error.message);
    console.info("incident.email_delivered", {
      severity: alert.severity,
      service: alert.service,
      environment: alert.environment,
      deployment: alert.deployment,
      emailId: data?.id ?? null,
    });
    return Response.json(
      { delivered: true, id: data?.id ?? null },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("incident.email_delivery_failed", {
      severity: alert.severity,
      service: alert.service,
      environment: alert.environment,
      deployment: alert.deployment,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return Response.json(
      { error: "Incident email delivery failed." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
