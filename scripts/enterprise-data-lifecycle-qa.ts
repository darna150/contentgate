import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { supabaseProjectRef } from "../src/lib/onboarding/environment.ts";

loadEnvConfig(process.cwd());

const STAGING_PROJECT_REF = "bncwjibscptgijgmuhrn";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");
const ZIP = Buffer.from("504b0506000000000000000000000000000000000000", "hex");

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function runLifecycleScript(script: string, args: string[]) {
  return execFileSync("npx", ["tsx", script, ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function expectLifecycleFailure(script: string, args: string[], pattern: RegExp) {
  try {
    runLifecycleScript(script, args);
  } catch (error) {
    const output = `${(error as { stdout?: string }).stdout ?? ""}\n${(error as { stderr?: string }).stderr ?? ""}`;
    if (!pattern.test(output)) throw new Error(`Unexpected lifecycle failure: ${output}`);
    return;
  }
  throw new Error(`Expected ${script} to fail.`);
}

async function main() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  if (
    process.env.CONTENTGATE_ENVIRONMENT !== "staging" ||
    process.env.CONTENTGATE_SUPABASE_PROJECT_REF !== STAGING_PROJECT_REF ||
    supabaseProjectRef(url) !== STAGING_PROJECT_REF
  ) {
    throw new Error("Enterprise data lifecycle QA is hard-restricted to ContentGate staging.");
  }
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const suffix = randomUUID().slice(0, 8);
  const organizationId = randomUUID();
  const workspaceKey = `qa-lifecycle-${suffix}`;
  const email = `data-lifecycle-${suffix}@contentgate.example`;
  const password = `CgData!${randomUUID()}aA7`;
  const tempDirectory = await mkdtemp(join(tmpdir(), "contentgate-data-lifecycle-"));
  const exportPath = join(tempDirectory, `${workspaceKey}.zip`);
  let userId: string | null = null;
  let completed = false;
  const storage = [
    { bucket: "documents", path: `${organizationId}/proof.pdf`, bytes: PDF, contentType: "application/pdf" },
    { bucket: "product-assets", path: `${organizationId}/proof.png`, bytes: PNG, contentType: "image/png" },
    { bucket: "rendered-assets", path: `${organizationId}/proof.png`, bytes: PNG, contentType: "image/png" },
    { bucket: "template-bundles", path: `${organizationId}/proof.zip`, bytes: ZIP, contentType: "application/zip" },
  ];

  try {
    const { error: organizationError } = await admin.from("organizations").insert({
      id: organizationId,
      workspace_key: workspaceKey,
      name: `Enterprise Data Lifecycle QA ${suffix}`,
      industry: "Disposable enterprise QA",
    });
    if (organizationError) throw organizationError;
    const { error: provisionError } = await admin.rpc("provision_user", {
      provision_email: email,
      provision_org_id: organizationId,
      provision_role: "admin",
      provision_full_name: `Data lifecycle admin ${suffix}`,
    });
    if (provisionError) throw provisionError;
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (userError || !userData.user) throw userError ?? new Error("Auth user was not created.");
    userId = userData.user.id;

    const { data: product, error: productError } = await admin.from("products").insert({
      org_id: organizationId,
      name: `Lifecycle product ${suffix}`,
      status: "active",
    }).select("id").single();
    if (productError) throw productError;
    const { error: auditError } = await admin.from("audit_log").insert({
      org_id: organizationId,
      actor_id: userId,
      action: "enterprise_data_lifecycle_qa_seed",
      entity_type: "product",
      entity_id: product.id,
      detail: { synthetic: true },
    });
    if (auditError) throw auditError;

    for (const object of storage) {
      const { error } = await admin.storage.from(object.bucket).upload(object.path, object.bytes, {
        contentType: object.contentType,
        upsert: false,
      });
      if (error) throw new Error(`Upload ${object.bucket}: ${error.message}`);
    }

    const exportOutput = runLifecycleScript("scripts/export-workspace-data.ts", [
      "--workspace-key", workspaceKey,
      "--output", exportPath,
      "--requester", "qa-requester@contentgate.example",
      "--reason", "Enterprise data lifecycle staging certification",
      "--confirmation", `EXPORT STAGING ${workspaceKey}`,
    ]);
    const exportReceipt = JSON.parse(exportOutput) as { archiveSha256: string; receiptId: string };

    const { error: holdError } = await admin.rpc("set_workspace_legal_hold", {
      p_organization_id: organizationId,
      p_workspace_key: workspaceKey,
      p_legal_hold: true,
      p_reference: `qa-hold-${suffix}`,
    });
    if (holdError) throw holdError;
    const deletionArgs = [
      "--workspace-key", workspaceKey,
      "--export", exportPath,
      "--requester", "qa-requester@contentgate.example",
      "--approver", "qa-approver@contentgate.example",
      "--reason", "Approved enterprise data lifecycle staging certification",
      "--confirmation", `DELETE STAGING ${workspaceKey}`,
    ];
    expectLifecycleFailure(
      "scripts/delete-workspace-data.ts",
      deletionArgs,
      /under legal hold/i,
    );
    const { error: releaseError } = await admin.rpc("set_workspace_legal_hold", {
      p_organization_id: organizationId,
      p_workspace_key: workspaceKey,
      p_legal_hold: false,
      p_reference: "qa hold released",
    });
    if (releaseError) throw releaseError;

    const samePersonArgs = [...deletionArgs];
    samePersonArgs[samePersonArgs.indexOf("--approver") + 1] = "qa-requester@contentgate.example";
    expectLifecycleFailure(
      "scripts/delete-workspace-data.ts",
      samePersonArgs,
      /different people/i,
    );

    const completedReceipt = JSON.parse(
      runLifecycleScript("scripts/delete-workspace-data.ts", deletionArgs),
    ) as { receiptId: string; status: string };
    if (completedReceipt.status !== "completed") throw new Error("Deletion did not complete.");
    completed = true;

    const { count: organizationCount } = await admin
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("id", organizationId);
    const { count: profileCount } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("org_id", organizationId);
    if (organizationCount !== 0 || profileCount !== 0) {
      throw new Error("Deleted workspace rows remain.");
    }
    for (const object of storage) {
      const { data, error } = await admin.storage.from(object.bucket).list(organizationId);
      if (error || (data?.length ?? 0) !== 0) throw new Error(`${object.bucket} objects remain.`);
    }
    const { data: deletedUser } = await admin.auth.admin.getUserById(userId);
    if (deletedUser.user) throw new Error("Deleted Auth user remains.");

    const { data: deletionReceipt, error: deletionReceiptError } = await admin
      .from("workspace_deletion_receipts")
      .select("status, export_sha256, auth_user_count, storage_object_count")
      .eq("id", completedReceipt.receiptId)
      .single();
    if (deletionReceiptError || deletionReceipt?.status !== "completed") {
      throw deletionReceiptError ?? new Error("Global deletion receipt did not survive.");
    }
    if (
      deletionReceipt.export_sha256 !== exportReceipt.archiveSha256 ||
      deletionReceipt.auth_user_count !== 1 ||
      deletionReceipt.storage_object_count !== storage.length
    ) {
      throw new Error("Deletion receipt counts or export hash do not match.");
    }

    const { data: browserReceipts, error: browserReceiptError } = await anon
      .from("workspace_deletion_receipts")
      .select("id")
      .eq("id", completedReceipt.receiptId);
    if (!browserReceiptError && (browserReceipts?.length ?? 0) > 0) {
      throw new Error("Anonymous client could read a deletion receipt.");
    }

    console.log(JSON.stringify({
      status: "passed",
      projectRef: STAGING_PROJECT_REF,
      workspaceKey,
      organizationId,
      exportReceiptId: exportReceipt.receiptId,
      deletionReceiptId: completedReceipt.receiptId,
      archiveSha256: exportReceipt.archiveSha256,
      authUsersDeleted: 1,
      storageObjectsDeleted: storage.length,
      legalHoldBlocked: true,
      dualApprovalEnforced: true,
    }, null, 2));
  } finally {
    if (!completed) {
      for (const object of storage) await admin.storage.from(object.bucket).remove([object.path]);
      await admin.from("audit_log").delete().eq("org_id", organizationId);
      await admin.from("products").delete().eq("org_id", organizationId);
      if (userId) await admin.auth.admin.deleteUser(userId, false);
      await admin.from("organizations").delete().eq("id", organizationId);
    }
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
