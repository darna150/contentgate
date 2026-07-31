import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";

import {
  checkWorkspaceDataOperation,
  parseWorkspaceExportManifest,
} from "../src/lib/workspace-data-lifecycle.ts";

loadEnvConfig(process.cwd());

type Options = {
  workspaceKey: string;
  exportPath: string;
  requester: string;
  approver: string;
  reason: string;
  confirmation: string;
  changeId?: string;
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
  return {
    workspaceKey: required("workspace-key"),
    exportPath: required("export"),
    requester: required("requester"),
    approver: required("approver"),
    reason: required("reason"),
    confirmation: required("confirmation"),
    changeId: values.get("change-id")?.trim(),
  };
}

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const environmentCheck = checkWorkspaceDataOperation({
    action: "DELETE",
    environment: process.env.CONTENTGATE_ENVIRONMENT,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    expectedProjectRef: process.env.CONTENTGATE_SUPABASE_PROJECT_REF,
    workspaceKey: options.workspaceKey,
    confirmation: options.confirmation,
    allowProduction: process.env.CONTENTGATE_ALLOW_PRODUCTION_DELETION,
    productionChangeId: options.changeId,
  });
  if (!environmentCheck.ok || !environmentCheck.environment) {
    throw new Error(environmentCheck.errors.join("\n"));
  }
  if (options.requester.trim().toLowerCase() === options.approver.trim().toLowerCase()) {
    throw new Error("Requester and approver must be different people.");
  }

  const archive = new Uint8Array(await readFile(options.exportPath));
  const archiveSha256 = sha256(archive);
  const entries = unzipSync(archive);
  const manifestBytes = entries["manifest.json"];
  if (!manifestBytes) throw new Error("Export archive has no manifest.json.");
  const manifest = parseWorkspaceExportManifest(JSON.parse(strFromU8(manifestBytes)));
  if (
    manifest.workspaceKey !== options.workspaceKey ||
    manifest.environment !== environmentCheck.environment
  ) {
    throw new Error("Export manifest does not match the requested workspace and environment.");
  }
  const expectedPaths = new Set(["manifest.json", ...manifest.entries.map((entry) => entry.path)]);
  const actualPaths = Object.keys(entries);
  if (actualPaths.length !== expectedPaths.size || actualPaths.some((path) => !expectedPaths.has(path))) {
    throw new Error("Export archive entries do not exactly match its manifest.");
  }
  for (const entry of manifest.entries) {
    const bytes = entries[entry.path];
    if (!bytes || bytes.byteLength !== entry.bytes || sha256(bytes) !== entry.sha256) {
      throw new Error(`Export archive integrity failed for ${entry.path}.`);
    }
  }

  const admin = createClient(
    required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    required(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id, workspace_key, legal_hold, legal_hold_reference")
    .eq("workspace_key", options.workspaceKey)
    .single();
  if (organizationError || !organization) {
    throw new Error(`Resolve workspace: ${organizationError?.message ?? "not found"}`);
  }
  if (organization.id !== manifest.organizationId) {
    throw new Error("Live workspace ID does not match the export manifest.");
  }
  if (organization.legal_hold) {
    throw new Error(`Workspace is under legal hold: ${organization.legal_hold_reference ?? "reference withheld"}`);
  }

  const { data: storageObjects, error: storageError } = await admin.rpc(
    "list_workspace_storage_objects",
    { p_organization_id: organization.id },
  );
  if (storageError) throw new Error(`List workspace storage: ${storageError.message}`);

  let receiptId: string | null = null;
  try {
    const { data, error } = await admin.rpc("begin_workspace_deletion", {
      p_organization_id: organization.id,
      p_workspace_key: options.workspaceKey,
      p_environment: environmentCheck.environment,
      p_requested_by: options.requester,
      p_approved_by: options.approver,
      p_reason: options.reason,
      p_export_sha256: archiveSha256,
      p_storage_object_count: storageObjects?.length ?? 0,
      p_change_id: options.changeId ?? null,
      p_confirmation: options.confirmation,
    });
    if (error || !data) throw new Error(`Begin workspace deletion: ${error?.message ?? "no receipt"}`);
    receiptId = data as string;

    const { data: prepared, error: prepareError } = await admin.rpc(
      "prepare_workspace_deletion",
      { p_receipt_id: receiptId },
    );
    if (prepareError || !prepared) {
      throw new Error(`Prepare workspace deletion: ${prepareError?.message ?? "no receipt"}`);
    }

    const objectsByBucket = new Map<string, string[]>();
    for (const object of storageObjects ?? []) {
      const bucket = object.bucket_id as string;
      const paths = objectsByBucket.get(bucket) ?? [];
      paths.push(object.object_name as string);
      objectsByBucket.set(bucket, paths);
    }
    for (const [bucket, paths] of objectsByBucket) {
      for (let index = 0; index < paths.length; index += 100) {
        const { error } = await admin.storage.from(bucket).remove(paths.slice(index, index + 100));
        if (error) throw new Error(`Remove ${bucket} storage: ${error.message}`);
      }
    }

    const userIds = (prepared as { userIds?: unknown }).userIds;
    if (!Array.isArray(userIds) || userIds.some((id) => typeof id !== "string")) {
      throw new Error("Prepare receipt returned invalid Auth user IDs.");
    }
    for (const userId of userIds as string[]) {
      const { error: banError } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: "876000h",
      });
      if (banError) throw new Error(`Disable workspace Auth user: ${banError.message}`);
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId, false);
      if (deleteError) throw new Error(`Delete workspace Auth user: ${deleteError.message}`);
    }

    const { data: completed, error: finalizeError } = await admin.rpc(
      "finalize_workspace_deletion",
      { p_receipt_id: receiptId },
    );
    if (finalizeError || !completed) {
      throw new Error(`Finalize workspace deletion: ${finalizeError?.message ?? "no receipt"}`);
    }
    console.log(JSON.stringify(completed, null, 2));
  } catch (error) {
    if (receiptId) {
      await admin.rpc("record_workspace_deletion_failure", {
        p_receipt_id: receiptId,
        p_failure_detail: error instanceof Error ? error.message : "unspecified failure",
      });
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
