import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { strToU8, zipSync } from "fflate";

import {
  checkWorkspaceDataOperation,
  safeArchiveEntryPath,
  type WorkspaceExportManifest,
} from "../src/lib/workspace-data-lifecycle.ts";

loadEnvConfig(process.cwd());

const MAX_ARCHIVE_INPUT_BYTES = 250 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 10_000;
const PAGE_SIZE = 1_000;

type Options = {
  workspaceKey: string;
  output: string;
  requester: string;
  reason: string;
  confirmation: string;
};

function parseArgs(args: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error(`Unknown or incomplete option: ${key ?? ""}`);
    values.set(key.slice(2), value);
  }
  const required = (name: string) => {
    const value = values.get(name)?.trim();
    if (!value) throw new Error(`--${name} is required.`);
    return value;
  };
  const output = required("output");
  if (!output.endsWith(".zip")) throw new Error("--output must end in .zip.");
  return {
    workspaceKey: required("workspace-key"),
    output,
    requester: required("requester"),
    reason: required("reason"),
    confirmation: required("confirmation"),
  };
}

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function jsonBytes(value: unknown) {
  return strToU8(
    `${JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item, 2)}\n`,
  );
}

async function migrationHead() {
  const names = (await readdir(new URL("../supabase/migrations/", import.meta.url)))
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .sort();
  if (!names.length) throw new Error("No migrations found.");
  return names.at(-1)!.slice(0, 14);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const environmentCheck = checkWorkspaceDataOperation({
    action: "EXPORT",
    environment: process.env.CONTENTGATE_ENVIRONMENT,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    expectedProjectRef: process.env.CONTENTGATE_SUPABASE_PROJECT_REF,
    workspaceKey: options.workspaceKey,
    confirmation: options.confirmation,
    allowProduction: process.env.CONTENTGATE_ALLOW_PRODUCTION_DATA_EXPORT,
  });
  if (!environmentCheck.ok || !environmentCheck.environment) {
    throw new Error(environmentCheck.errors.join("\n"));
  }

  const inventory = JSON.parse(
    await readFile(new URL("../config/workspace-data-lifecycle.json", import.meta.url), "utf8"),
  ) as { orgScopedTables: Array<{ name: string }> };
  const admin = createClient(
    required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    required(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("*")
    .eq("workspace_key", options.workspaceKey)
    .single();
  if (organizationError || !organization) {
    throw new Error(`Resolve workspace: ${organizationError?.message ?? "not found"}`);
  }
  const organizationId = organization.id as string;
  const archiveEntries: Record<string, Uint8Array> = {};
  const manifestEntries: WorkspaceExportManifest["entries"] = [];
  const tableRows: Record<string, number> = {};
  let inputBytes = 0;

  const addEntry = (path: string, bytes: Uint8Array) => {
    const safePath = safeArchiveEntryPath(path);
    if (archiveEntries[safePath]) throw new Error(`Duplicate archive entry: ${safePath}`);
    inputBytes += bytes.byteLength;
    if (inputBytes > MAX_ARCHIVE_INPUT_BYTES) {
      throw new Error(`Export exceeds the ${MAX_ARCHIVE_INPUT_BYTES}-byte beta limit.`);
    }
    if (manifestEntries.length + 1 >= MAX_ARCHIVE_ENTRIES) {
      throw new Error(`Export exceeds the ${MAX_ARCHIVE_ENTRIES}-entry beta limit.`);
    }
    archiveEntries[safePath] = bytes;
    manifestEntries.push({ path: safePath, sha256: sha256(bytes), bytes: bytes.byteLength });
  };

  addEntry("control-plane/organization.json", jsonBytes(organization));

  const tableData = new Map<string, Array<Record<string, unknown>>>();
  for (const table of inventory.orgScopedTables) {
    const rows: Array<Record<string, unknown>> = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await admin
        .from(table.name)
        .select("*")
        .eq("org_id", organizationId)
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`Export ${table.name}: ${error.message}`);
      rows.push(...((data ?? []) as Array<Record<string, unknown>>));
      if ((data?.length ?? 0) < PAGE_SIZE) break;
    }
    tableData.set(table.name, rows);
    tableRows[table.name] = rows.length;
    addEntry(safeArchiveEntryPath("database", `${table.name}.json`), jsonBytes(rows));
  }

  const { data: onboardingRuns, error: runsError } = await admin
    .from("onboarding_runs")
    .select("*")
    .eq("organization_id", organizationId);
  if (runsError) throw new Error(`Export onboarding runs: ${runsError.message}`);
  const runIds = (onboardingRuns ?? []).map((run) => run.id as string);
  let onboardingSteps: Array<Record<string, unknown>> = [];
  if (runIds.length) {
    const { data, error } = await admin.from("onboarding_run_steps").select("*").in("run_id", runIds);
    if (error) throw new Error(`Export onboarding steps: ${error.message}`);
    onboardingSteps = (data ?? []) as Array<Record<string, unknown>>;
  }
  tableRows.onboarding_runs = onboardingRuns?.length ?? 0;
  tableRows.onboarding_run_steps = onboardingSteps.length;
  addEntry("control-plane/onboarding_runs.json", jsonBytes(onboardingRuns ?? []));
  addEntry("control-plane/onboarding_run_steps.json", jsonBytes(onboardingSteps));

  const profileIds = (tableData.get("profiles") ?? [])
    .map((profile) => profile.id)
    .filter((id): id is string => typeof id === "string");
  const authUsers = [];
  for (const userId of profileIds) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) throw new Error(`Export Auth identity ${userId}: ${error?.message ?? "not found"}`);
    authUsers.push({
      id: data.user.id,
      email: data.user.email ?? null,
      createdAt: data.user.created_at,
      lastSignInAt: data.user.last_sign_in_at ?? null,
      bannedUntil: data.user.banned_until ?? null,
      factors: (data.user.factors ?? []).map((factor) => ({
        factorType: factor.factor_type,
        status: factor.status,
      })),
    });
  }
  addEntry("auth/users.json", jsonBytes(authUsers));

  const { data: storageObjects, error: storageError } = await admin.rpc(
    "list_workspace_storage_objects",
    { p_organization_id: organizationId },
  );
  if (storageError) throw new Error(`List workspace storage: ${storageError.message}`);
  for (const object of storageObjects ?? []) {
    const bucket = object.bucket_id as string;
    const name = object.object_name as string;
    const { data, error } = await admin.storage.from(bucket).download(name);
    if (error || !data) throw new Error(`Download ${bucket}/${name}: ${error?.message ?? "not found"}`);
    addEntry(safeArchiveEntryPath("storage", bucket, name), new Uint8Array(await data.arrayBuffer()));
  }

  const manifest: WorkspaceExportManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    environment: environmentCheck.environment,
    organizationId,
    workspaceKey: options.workspaceKey,
    migrationHead: await migrationHead(),
    tableRows,
    entries: [...manifestEntries].sort((left, right) => left.path.localeCompare(right.path)),
    limitations: [
      "The export is a bounded sequential snapshot, not a transactionally frozen database snapshot.",
      "Password hashes, MFA secrets, access tokens, refresh tokens, and session records are excluded.",
      "Short-lived onboarding package uploads are operator-scoped and are purged by expiry rather than attributed to a workspace export.",
      "Provider backups age out under the configured processor retention and are not embedded in this archive.",
    ],
  };
  const manifestBytes = jsonBytes(manifest);
  const manifestSha256 = sha256(manifestBytes);
  archiveEntries["manifest.json"] = manifestBytes;
  const archive = zipSync(archiveEntries, { level: 6 });
  const archiveSha256 = sha256(archive);

  await writeFile(options.output, archive, { flag: "wx", mode: 0o600 });
  await writeFile(`${options.output}.sha256`, `${archiveSha256}  ${basename(options.output)}\n`, {
    flag: "wx",
    mode: 0o600,
  });

  const { data: receiptId, error: receiptError } = await admin.rpc(
    "record_workspace_data_export",
    {
      p_organization_id: organizationId,
      p_workspace_key: options.workspaceKey,
      p_environment: environmentCheck.environment,
      p_requested_by: options.requester,
      p_reason: options.reason,
      p_archive_sha256: archiveSha256,
      p_manifest_sha256: manifestSha256,
      p_archive_bytes: archive.byteLength,
      p_entry_count: manifest.entries.length + 1,
    },
  );
  if (receiptError) {
    throw new Error(`Record export receipt: ${receiptError.message}. Archive exists but is not deletion-eligible.`);
  }

  console.log(JSON.stringify({
    status: "exported",
    environment: environmentCheck.environment,
    workspaceKey: options.workspaceKey,
    organizationId,
    receiptId,
    output: options.output,
    archiveSha256,
    archiveBytes: archive.byteLength,
    entries: manifest.entries.length + 1,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
