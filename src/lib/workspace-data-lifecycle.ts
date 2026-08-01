import { supabaseProjectRef } from "./onboarding/environment.ts";

export type WorkspaceDataEnvironment = "staging" | "production";
export type WorkspaceDataAction = "EXPORT" | "DELETE";

export type WorkspaceExportManifest = {
  schemaVersion: 1;
  generatedAt: string;
  environment: WorkspaceDataEnvironment;
  organizationId: string;
  workspaceKey: string;
  migrationHead: string;
  tableRows: Record<string, number>;
  entries: Array<{ path: string; sha256: string; bytes: number }>;
  limitations: string[];
};

export function workspaceDataConfirmation(
  action: WorkspaceDataAction,
  environment: WorkspaceDataEnvironment,
  workspaceKey: string,
) {
  return `${action} ${environment.toUpperCase()} ${workspaceKey}`;
}

export function checkWorkspaceDataOperation(input: {
  action: WorkspaceDataAction;
  environment: string | undefined;
  supabaseUrl: string | undefined;
  expectedProjectRef: string | undefined;
  workspaceKey: string;
  confirmation: string | undefined;
  allowProduction: string | undefined;
  productionChangeId?: string | undefined;
}) {
  const errors: string[] = [];
  const environment = ["staging", "production"].includes(input.environment ?? "")
    ? (input.environment as WorkspaceDataEnvironment)
    : null;
  if (!environment) {
    errors.push("CONTENTGATE_ENVIRONMENT must be staging or production.");
  }

  const projectRef = supabaseProjectRef(input.supabaseUrl);
  if (!projectRef) errors.push("NEXT_PUBLIC_SUPABASE_URL must identify a hosted Supabase project.");
  if (!input.expectedProjectRef) {
    errors.push("CONTENTGATE_SUPABASE_PROJECT_REF is required.");
  } else if (projectRef && projectRef !== input.expectedProjectRef) {
    errors.push(
      `Supabase project mismatch: URL resolves to ${projectRef}, expected ${input.expectedProjectRef}.`,
    );
  }

  if (environment) {
    const expected = workspaceDataConfirmation(input.action, environment, input.workspaceKey);
    if (input.confirmation !== expected) {
      errors.push(`Confirmation must exactly match: ${expected}`);
    }
    if (environment === "production") {
      if (input.allowProduction !== "true") {
        errors.push(`Production ${input.action.toLowerCase()} is disabled.`);
      }
      if (input.action === "DELETE" && !input.productionChangeId?.trim()) {
        errors.push("Production deletion requires a change identifier.");
      }
    }
  }

  return { ok: errors.length === 0, environment, projectRef, errors };
}

export function safeArchiveEntryPath(...parts: string[]) {
  const segments = parts.flatMap((part) => part.split("/"));
  if (
    segments.some(
      (segment) =>
        !segment || segment === "." || segment === ".." ||
        segment.includes("\\") || segment.includes("\0"),
    )
  ) {
    throw new Error("Unsafe archive entry path.");
  }
  return segments.join("/");
}

export function parseWorkspaceExportManifest(value: unknown): WorkspaceExportManifest {
  if (!value || typeof value !== "object") throw new Error("Export manifest is not an object.");
  const candidate = value as Partial<WorkspaceExportManifest>;
  if (
    candidate.schemaVersion !== 1 ||
    !candidate.organizationId ||
    !candidate.workspaceKey ||
    !candidate.generatedAt ||
    !candidate.migrationHead ||
    !["staging", "production"].includes(candidate.environment ?? "") ||
    !candidate.tableRows ||
    !Array.isArray(candidate.entries) ||
    !Array.isArray(candidate.limitations)
  ) {
    throw new Error("Export manifest is incomplete or unsupported.");
  }
  for (const entry of candidate.entries) {
    safeArchiveEntryPath(entry.path);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0) {
      throw new Error("Export manifest contains an invalid entry.");
    }
  }
  return candidate as WorkspaceExportManifest;
}
