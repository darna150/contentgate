export type IncidentSeverity = "P0" | "P1" | "P2";

export type IncidentAlert = {
  severity: IncidentSeverity;
  service: string;
  summary: string;
  occurredAt: string;
  environment: string;
  deployment: string | null;
  owner: string;
  details: Record<string, unknown>;
};

export type IncidentAlertConfig = {
  webhookUrl: string | undefined;
  webhookToken: string | undefined;
  owner: string | undefined;
};

export type IncidentAlertConfigField =
  | "CONTENTGATE_INCIDENT_WEBHOOK_URL"
  | "CONTENTGATE_INCIDENT_WEBHOOK_TOKEN"
  | "CONTENTGATE_INCIDENT_OWNER";

export function incidentAlertConfigFromEnvironment(): IncidentAlertConfig {
  return {
    webhookUrl: process.env.CONTENTGATE_INCIDENT_WEBHOOK_URL,
    webhookToken: process.env.CONTENTGATE_INCIDENT_WEBHOOK_TOKEN,
    owner: process.env.CONTENTGATE_INCIDENT_OWNER,
  };
}

export function incidentAlertConfigIssues(
  config: IncidentAlertConfig,
): IncidentAlertConfigField[] {
  const issues: IncidentAlertConfigField[] = [];
  try {
    const url = new URL(config.webhookUrl ?? "");
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") ||
      url.hostname.endsWith(".local")
    ) {
      issues.push("CONTENTGATE_INCIDENT_WEBHOOK_URL");
    }
  } catch {
    issues.push("CONTENTGATE_INCIDENT_WEBHOOK_URL");
  }
  if (!config.webhookToken || config.webhookToken.trim().length < 32) {
    issues.push("CONTENTGATE_INCIDENT_WEBHOOK_TOKEN");
  }
  if (!config.owner || config.owner.trim().length < 3) {
    issues.push("CONTENTGATE_INCIDENT_OWNER");
  }
  return issues;
}

export async function deliverIncidentAlert(
  input: Omit<IncidentAlert, "owner">,
  config = incidentAlertConfigFromEnvironment(),
  fetchImplementation: typeof fetch = fetch,
) {
  if (
    !config.webhookUrl ||
    !config.webhookToken ||
    !config.owner ||
    incidentAlertConfigIssues(config).length > 0
  ) {
    return { status: "unconfigured" as const };
  }
  const url = new URL(config.webhookUrl);
  if (url.protocol !== "https:") {
    throw new Error("Incident webhook must use HTTPS.");
  }
  const alert: IncidentAlert = { ...input, owner: config.owner };
  const response = await fetchImplementation(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.webhookToken}`,
    },
    body: JSON.stringify(alert),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error(`Incident webhook returned ${response.status}.`);
  }
  return { status: "delivered" as const };
}
