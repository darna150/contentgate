export type ContentGateEnvironment = "development" | "staging" | "production";

export type OnboardingEnvironmentInput = {
  target: string | undefined;
  supabaseUrl: string | undefined;
  expectedProjectRef: string | undefined;
  allowProduction: string | undefined;
  confirmation?: string | null;
  workspaceKey: string;
};

export type OnboardingEnvironmentCheck = {
  ok: boolean;
  target: ContentGateEnvironment | null;
  projectRef: string | null;
  errors: string[];
};

export function supabaseProjectRef(urlValue: string | undefined) {
  if (!urlValue) return null;
  try {
    const url = new URL(urlValue);
    const match = /^([a-z0-9-]+)\.supabase\.(?:co|net)$/i.exec(url.hostname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function productionConfirmation(workspaceKey: string) {
  return `PROVISION ${workspaceKey} IN PRODUCTION`;
}

export function checkOnboardingEnvironment(
  input: OnboardingEnvironmentInput,
): OnboardingEnvironmentCheck {
  const errors: string[] = [];
  const target = ["development", "staging", "production"].includes(input.target ?? "")
    ? (input.target as ContentGateEnvironment)
    : null;
  if (!target) errors.push("CONTENTGATE_ENVIRONMENT must be development, staging, or production.");

  const projectRef = supabaseProjectRef(input.supabaseUrl);
  if (!input.supabaseUrl) errors.push("NEXT_PUBLIC_SUPABASE_URL is required.");
  else if (!projectRef && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(input.supabaseUrl)) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL is not a recognized Supabase project URL.");
  }

  if (!input.expectedProjectRef) {
    errors.push("CONTENTGATE_SUPABASE_PROJECT_REF is required for mutating onboarding runs.");
  } else if (projectRef && input.expectedProjectRef !== projectRef) {
    errors.push(
      `Supabase project mismatch: URL resolves to ${projectRef}, expected ${input.expectedProjectRef}.`,
    );
  }

  if (target === "production") {
    if (input.allowProduction !== "true") {
      errors.push("Production onboarding is disabled. Set CONTENTGATE_ALLOW_PRODUCTION_ONBOARDING=true for the reviewed operation.");
    }
    const expected = productionConfirmation(input.workspaceKey);
    if (input.confirmation !== expected) {
      errors.push(`Production confirmation must exactly match: ${expected}`);
    }
  }

  return { ok: errors.length === 0, target, projectRef, errors };
}

export function currentOnboardingEnvironmentInput(input: {
  workspaceKey: string;
  confirmation?: string | null;
}): OnboardingEnvironmentInput {
  return {
    target: process.env.CONTENTGATE_ENVIRONMENT,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    expectedProjectRef: process.env.CONTENTGATE_SUPABASE_PROJECT_REF,
    allowProduction: process.env.CONTENTGATE_ALLOW_PRODUCTION_ONBOARDING,
    confirmation: input.confirmation,
    workspaceKey: input.workspaceKey,
  };
}

export function platformOperatorEmails(value = process.env.CONTENTGATE_PLATFORM_OPERATOR_EMAILS) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isPlatformOperator(email: string | null | undefined, allowlist?: string) {
  return Boolean(email && platformOperatorEmails(allowlist).has(email.trim().toLowerCase()));
}
