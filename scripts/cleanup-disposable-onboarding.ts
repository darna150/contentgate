import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import {
  checkOnboardingEnvironment,
  currentOnboardingEnvironmentInput,
} from "../src/lib/onboarding/environment.ts";

loadEnvConfig(process.cwd());

const workspaceKey = process.argv[2]?.trim();
const confirmation = process.argv[3]?.trim();

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function pathsFromRows(
  rows: Array<Record<string, unknown>> | null,
  columns: string[],
) {
  return (rows ?? []).flatMap((row) =>
    columns.flatMap((column) => {
      const value = row[column];
      return typeof value === "string" && value.length > 0 ? [value] : [];
    }),
  );
}

async function main() {
  if (!workspaceKey?.startsWith("qa-onboarding-")) {
    throw new Error("Cleanup is restricted to qa-onboarding-* workspace keys.");
  }
  const expectedConfirmation = `DELETE STAGING ${workspaceKey}`;
  if (confirmation !== expectedConfirmation) {
    throw new Error(`Confirmation must exactly match: ${expectedConfirmation}`);
  }

  const environment = checkOnboardingEnvironment(
    currentOnboardingEnvironmentInput({ workspaceKey }),
  );
  if (!environment.ok || environment.target !== "staging") {
    throw new Error(
      ["Disposable onboarding cleanup is staging-only.", ...environment.errors].join("\n"),
    );
  }

  const admin = createClient(
    required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    required(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: run, error: runError } = await admin
    .from("onboarding_runs")
    .select("id, organization_id, status, environment")
    .eq("workspace_key", workspaceKey)
    .single();
  if (runError) throw new Error(`Find onboarding run: ${runError.message}`);
  if (run.status !== "completed" || run.environment !== "staging" || !run.organization_id) {
    throw new Error("Cleanup requires one completed staging run with an organization.");
  }
  const organizationId = run.organization_id as string;

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id, workspace_key")
    .eq("id", organizationId)
    .single();
  if (organizationError) {
    throw new Error(`Verify disposable organization: ${organizationError.message}`);
  }
  if (organization.workspace_key !== workspaceKey) {
    throw new Error("The run organization does not match the disposable workspace key.");
  }

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id")
    .eq("org_id", organizationId);
  if (profilesError) throw new Error(`List disposable profiles: ${profilesError.message}`);
  if (!profiles || profiles.length === 0) {
    throw new Error("The disposable organization has no users to verify.");
  }

  const users = [];
  for (const profile of profiles) {
    const { data, error } = await admin.auth.admin.getUserById(profile.id);
    if (error || !data.user?.email) {
      throw new Error(`Resolve disposable Auth user ${profile.id}: ${error?.message ?? "not found"}`);
    }
    if (!/^hol\+cg-onboarding-(admin|member)-\d{8}@justdebbie\.ing$/i.test(data.user.email)) {
      throw new Error(`Refusing to delete non-disposable user ${data.user.email}.`);
    }
    users.push(data.user);
  }

  const storageQueries = await Promise.all([
    admin.from("documents").select("storage_path").eq("org_id", organizationId),
    admin
      .from("product_assets")
      .select("storage_path, preview_storage_path, poster_storage_path, transcoded_storage_path")
      .eq("org_id", organizationId),
    admin
      .from("product_asset_versions")
      .select("storage_path, preview_storage_path, poster_storage_path, transcoded_storage_path")
      .eq("org_id", organizationId),
    admin.from("render_jobs").select("output_storage_path").eq("org_id", organizationId),
    admin.from("template_assets").select("storage_path").eq("org_id", organizationId),
  ]);
  for (const result of storageQueries) {
    if (result.error) throw new Error(`Collect disposable storage paths: ${result.error.message}`);
  }
  const storageByBucket = new Map<string, string[]>([
    ["documents", pathsFromRows(storageQueries[0].data, ["storage_path"])],
    [
      "product-assets",
      [
        ...pathsFromRows(storageQueries[1].data, [
          "storage_path",
          "preview_storage_path",
          "poster_storage_path",
          "transcoded_storage_path",
        ]),
        ...pathsFromRows(storageQueries[2].data, [
          "storage_path",
          "preview_storage_path",
          "poster_storage_path",
          "transcoded_storage_path",
        ]),
        ...pathsFromRows(storageQueries[3].data, ["output_storage_path"]),
      ],
    ],
    ["template-bundles", pathsFromRows(storageQueries[4].data, ["storage_path"])],
  ]);

  let removedStorageObjects = 0;
  for (const [bucket, rawPaths] of storageByBucket) {
    const paths = [...new Set(rawPaths)];
    for (let index = 0; index < paths.length; index += 100) {
      const batch = paths.slice(index, index + 100);
      if (batch.length === 0) continue;
      const { error } = await admin.storage.from(bucket).remove(batch);
      if (error) throw new Error(`Remove ${bucket} objects: ${error.message}`);
      removedStorageObjects += batch.length;
    }
  }

  const { error: prepareError } = await admin.rpc(
    "dispose_completed_onboarding_run",
    { p_run_id: run.id, p_confirmation: confirmation, p_finalize: false },
  );
  if (prepareError) {
    throw new Error(`Prepare disposable tenant cleanup: ${prepareError.message}`);
  }

  for (const user of users) {
    const { error } = await admin.auth.admin.deleteUser(user.id, false);
    if (error) throw new Error(`Delete disposable Auth user: ${error.message}`);
  }

  const { error: finalizeError } = await admin.rpc(
    "dispose_completed_onboarding_run",
    { p_run_id: run.id, p_confirmation: confirmation, p_finalize: true },
  );
  if (finalizeError) {
    throw new Error(`Finalize disposable tenant cleanup: ${finalizeError.message}`);
  }

  console.log(
    JSON.stringify({
      workspaceKey,
      runId: run.id,
      organizationId,
      deletedUsers: users.length,
      removedStorageObjects,
      auditReceiptPreserved: true,
      status: "deleted",
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
