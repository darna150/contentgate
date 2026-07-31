import { createHash, timingSafeEqual } from "node:crypto";

import type { IncidentAlert } from "./incident-alert";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const MAX_DETAIL_JSON_LENGTH = 20_000;

export type IncidentEmailConfig = {
  apiKey: string | undefined;
  from: string | undefined;
  to: string | undefined;
  replyTo: string | undefined;
};

export type IncidentEmailMessage = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  tags: Array<{ name: string; value: string }>;
};

export function incidentEmailConfigFromEnvironment(): IncidentEmailConfig {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.CONTENTGATE_INCIDENT_EMAIL_FROM,
    to: process.env.CONTENTGATE_INCIDENT_EMAIL_TO,
    replyTo: process.env.CONTENTGATE_INCIDENT_EMAIL_REPLY_TO,
  };
}

function addressFromMailbox(value: string) {
  const match = value.match(/<([^<>]+)>\s*$/u);
  return (match?.[1] ?? value).trim();
}

export function incidentEmailConfigIssues(config: IncidentEmailConfig) {
  const issues: string[] = [];
  if (!config.apiKey || config.apiKey.trim().length < 16) {
    issues.push("RESEND_API_KEY");
  }
  if (!config.from || !EMAIL_PATTERN.test(addressFromMailbox(config.from))) {
    issues.push("CONTENTGATE_INCIDENT_EMAIL_FROM");
  }
  if (!config.to || !EMAIL_PATTERN.test(config.to.trim())) {
    issues.push("CONTENTGATE_INCIDENT_EMAIL_TO");
  }
  if (config.replyTo && !EMAIL_PATTERN.test(config.replyTo.trim())) {
    issues.push("CONTENTGATE_INCIDENT_EMAIL_REPLY_TO");
  }
  return issues;
}

function boundedString(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum
    ? value
    : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseIncidentAlert(value: unknown): IncidentAlert | null {
  if (!isPlainRecord(value)) return null;
  const severity = value.severity;
  const service = boundedString(value.service, 120);
  const summary = boundedString(value.summary, 500);
  const occurredAt = boundedString(value.occurredAt, 80);
  const environment = boundedString(value.environment, 80);
  const owner = boundedString(value.owner, 160);
  const deployment = value.deployment;
  const details = value.details;
  if (
    (severity !== "P0" && severity !== "P1" && severity !== "P2") ||
    !service ||
    !summary ||
    !occurredAt ||
    !Number.isFinite(Date.parse(occurredAt)) ||
    !environment ||
    !owner ||
    (deployment !== null && boundedString(deployment, 240) === null) ||
    !isPlainRecord(details)
  ) {
    return null;
  }
  return {
    severity,
    service,
    summary,
    occurredAt,
    environment,
    deployment: deployment as string | null,
    owner,
    details,
  };
}

export function incidentWebhookAuthorized(
  authorization: string | null,
  expectedToken: string | undefined,
) {
  if (!expectedToken || expectedToken.trim().length < 32) return false;
  if (!authorization?.startsWith("Bearer ")) return false;
  const receivedToken = authorization.slice("Bearer ".length);
  const expected = Buffer.from(expectedToken);
  const received = Buffer.from(receivedToken);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/gu, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return replacements[character];
  });
}

function safeSubject(summary: string) {
  return summary.replace(/[\r\n]+/gu, " ").trim().slice(0, 140);
}

export function incidentEmailIdempotencyKey(alert: IncidentAlert) {
  return `contentgate-incident-${createHash("sha256")
    .update(`${alert.severity}\n${alert.service}\n${alert.occurredAt}\n${alert.deployment ?? ""}`)
    .digest("hex")}`;
}

export function buildIncidentEmail(
  alert: IncidentAlert,
  config: IncidentEmailConfig,
): IncidentEmailMessage {
  const issues = incidentEmailConfigIssues(config);
  if (issues.length > 0 || !config.from || !config.to) {
    throw new Error(`Incident email configuration is incomplete: ${issues.join(", ")}.`);
  }
  const detailJson = JSON.stringify(alert.details, null, 2).slice(0, MAX_DETAIL_JSON_LENGTH);
  const fields = [
    ["Severity", alert.severity],
    ["Service", alert.service],
    ["Environment", alert.environment],
    ["Occurred", alert.occurredAt],
    ["Deployment", alert.deployment ?? "unknown"],
    ["Owner", alert.owner],
  ] as const;
  const text = [
    `${alert.severity}: ${alert.summary}`,
    "",
    ...fields.map(([label, value]) => `${label}: ${value}`),
    "",
    "Details:",
    detailJson,
  ].join("\n");
  const fieldRows = fields
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:4px 12px 4px 0">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  return {
    from: config.from,
    to: config.to.trim(),
    replyTo: config.replyTo?.trim() || undefined,
    subject: `[ContentGate ${alert.severity}] ${safeSubject(alert.summary)}`,
    text,
    html: [
      "<!doctype html><html><body style=\"font-family:Arial,sans-serif;color:#171717\">",
      `<h1 style="font-size:20px">${escapeHtml(alert.severity)}: ${escapeHtml(alert.summary)}</h1>`,
      `<table>${fieldRows}</table>`,
      "<h2 style=\"font-size:16px\">Details</h2>",
      `<pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:6px">${escapeHtml(detailJson)}</pre>`,
      "</body></html>",
    ].join(""),
    tags: [
      { name: "severity", value: alert.severity.toLowerCase() },
      { name: "service", value: alert.service.replace(/[^a-z0-9_-]/giu, "-").slice(0, 64) },
    ],
  };
}
