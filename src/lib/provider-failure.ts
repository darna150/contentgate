import {
  deliverIncidentAlert,
  type IncidentAlert,
  type IncidentAlertConfig,
} from "./incident-alert.ts";

export type IncidentDeliveryOutcome = "delivered" | "unconfigured" | "failed";

type FailureInjectionEnvironment = {
  CONTENTGATE_ENVIRONMENT?: string;
  CONTENTGATE_SUPABASE_PROJECT_REF?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
};

const STAGING_PROJECT_REF = "bncwjibscptgijgmuhrn";
const SYNTHETIC_PROVIDER_FAILURE_EMAIL =
  /^enterprise-provider-failure-[a-f0-9]{8}@contentgate\.example$/iu;

function environmentProjectRef(environment: FailureInjectionEnvironment) {
  const configured = environment.CONTENTGATE_SUPABASE_PROJECT_REF?.trim();
  if (configured) return configured;
  try {
    return new URL(environment.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0];
  } catch {
    return "";
  }
}

export function isSyntheticProviderFailureRequest(
  request: Request,
  userEmail: string | null | undefined,
  environment: FailureInjectionEnvironment = process.env,
) {
  const safeEnvironment =
    environment.CONTENTGATE_ENVIRONMENT === "staging" &&
    environmentProjectRef(environment) === STAGING_PROJECT_REF &&
    (environment.VERCEL_ENV === "preview" ||
      ["development", "test"].includes(environment.NODE_ENV ?? ""));
  return (
    safeEnvironment &&
    request.headers.get("x-contentgate-validation-run") === "provider-failure" &&
    SYNTHETIC_PROVIDER_FAILURE_EMAIL.test(userEmail ?? "")
  );
}

export async function reportProviderIncident(
  input: Omit<IncidentAlert, "owner">,
  options: {
    config?: IncidentAlertConfig;
    fetchImplementation?: typeof fetch;
    log?: Pick<Console, "error" | "info">;
  } = {},
): Promise<IncidentDeliveryOutcome> {
  const log = options.log ?? console;
  try {
    const result = await deliverIncidentAlert(
      input,
      options.config,
      options.fetchImplementation,
    );
    if (result.status === "unconfigured") {
      log.error(JSON.stringify({
        level: "error",
        event: "provider.incident_unconfigured",
        service: input.service,
        deployment: input.deployment,
      }));
      return "unconfigured";
    }
    log.info(JSON.stringify({
      level: "info",
      event: "provider.incident_delivered",
      service: input.service,
      deployment: input.deployment,
    }));
    return "delivered";
  } catch (error) {
    log.error(JSON.stringify({
      level: "error",
      event: "provider.incident_delivery_failed",
      service: input.service,
      deployment: input.deployment,
      error: error instanceof Error ? error.message : "unknown error",
    }));
    return "failed";
  }
}
