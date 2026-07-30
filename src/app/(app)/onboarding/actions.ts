"use server";

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkOnboardingEnvironment,
  currentOnboardingEnvironmentInput,
  productionConfirmation,
} from "@/lib/onboarding/environment";
import { provisionWorkspace } from "@/lib/onboarding/engine";
import { requirePlatformOperator, assertOperatorPackagePath } from "@/lib/onboarding/operator";
import { preflightWorkspacePackage } from "@/lib/onboarding/package";
import { createSupabaseOnboardingRepository } from "@/lib/onboarding/server-repository";
import { withStagedWorkspacePackage } from "@/lib/onboarding/staged-package";

const MAX_PACKAGE_BYTES = 50 * 1024 * 1024;

async function purgeExpiredPackages() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("onboarding_package_uploads")
    .select("id, storage_path")
    .in("status", ["awaiting_upload", "preflight_passed"])
    .lt("expires_at", new Date().toISOString())
    .limit(100);
  if (!data?.length) return;
  await admin.storage.from("onboarding-packages").remove(data.map((entry) => entry.storage_path));
  await admin
    .from("onboarding_package_uploads")
    .update({ status: "expired", consumed_at: new Date().toISOString() })
    .in("id", data.map((entry) => entry.id));
}

function safeZipName(value: string) {
  const name = value.split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9._-]+/g, "-") ?? "workspace.zip";
  return name.toLowerCase().endsWith(".zip") ? name : `${name}.zip`;
}

async function requestOrigin() {
  const configured = process.env.CONTENTGATE_APP_URL?.replace(/\/$/, "");
  if (configured) {
    const url = new URL(configured);
    if (!(["https:", "http:"].includes(url.protocol))) {
      throw new Error("CONTENTGATE_APP_URL must use http or https.");
    }
    if (process.env.CONTENTGATE_ENVIRONMENT !== "development" && url.protocol !== "https:") {
      throw new Error("CONTENTGATE_APP_URL must use https outside development.");
    }
    return url.origin;
  }
  const values = await headers();
  const host = values.get("x-forwarded-host") ?? values.get("host");
  if (!host) return process.env.CONTENTGATE_APP_URL?.replace(/\/$/, "");
  const proto = values.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

async function requireTrackedPackage(
  operatorUserId: string,
  storagePath: string,
  allowedStatuses: string[],
) {
  const { data, error } = await createAdminClient()
    .from("onboarding_package_uploads")
    .select("status")
    .eq("storage_path", storagePath)
    .eq("operator_user_id", operatorUserId)
    .maybeSingle();
  if (error || !data || !allowedStatuses.includes(data.status)) {
    throw new Error("The staged package is missing, expired, or not ready for this operation.");
  }
}

export async function createOnboardingPackageUpload(fileName: string, fileSize: number) {
  const operator = await requirePlatformOperator();
  await purgeExpiredPackages();
  if (!Number.isInteger(fileSize) || fileSize <= 0 || fileSize > MAX_PACKAGE_BYTES) {
    throw new Error("Choose a ZIP package between 1 byte and 50 MB.");
  }
  const storagePath = `${operator.userId}/${crypto.randomUUID()}/${safeZipName(fileName)}`;
  const admin = createAdminClient();
  const { error: trackingError } = await admin.from("onboarding_package_uploads").insert({
    storage_path: storagePath,
    operator_user_id: operator.userId,
    file_name: safeZipName(fileName),
    file_size_bytes: fileSize,
  });
  if (trackingError) throw new Error(`Could not track package upload: ${trackingError.message}`);
  const { data, error } = await admin
    .storage.from("onboarding-packages")
    .createSignedUploadUrl(storagePath);
  if (error || !data) {
    await admin.from("onboarding_package_uploads").update({ status: "discarded", consumed_at: new Date().toISOString() }).eq("storage_path", storagePath);
    throw new Error(`Could not stage package upload: ${error?.message ?? "unknown error"}`);
  }
  return { storagePath, token: data.token };
}

export async function preflightStagedOnboardingPackage(storagePath: string) {
  const operator = await requirePlatformOperator();
  assertOperatorPackagePath(operator.userId, storagePath);
  await requireTrackedPackage(operator.userId, storagePath, ["awaiting_upload", "preflight_passed"]);
  return withStagedWorkspacePackage(storagePath, async (directory) => {
    const result = await preflightWorkspacePackage(directory);
    const workspaceKey = result.prepared?.blueprint.workspace.key ?? result.blueprint.workspaceKey;
    const admin = createAdminClient();
    if (result.ok) {
      const { error } = await admin
        .from("onboarding_package_uploads")
        .update({ status: "preflight_passed" })
        .eq("storage_path", storagePath)
        .eq("operator_user_id", operator.userId);
      if (error) throw new Error(`Could not record package preflight: ${error.message}`);
    } else {
      await admin.storage.from("onboarding-packages").remove([storagePath]);
      await admin.from("onboarding_package_uploads").update({ status: "discarded", consumed_at: new Date().toISOString() }).eq("storage_path", storagePath);
    }
    return {
      ok: result.ok,
      issues: result.issues,
      counts: result.blueprint.counts,
      workspaceKey,
      blueprintSha256: result.prepared?.blueprintSha256 ?? null,
      environment: process.env.CONTENTGATE_ENVIRONMENT ?? null,
      productionConfirmation:
        process.env.CONTENTGATE_ENVIRONMENT === "production" && workspaceKey
          ? productionConfirmation(workspaceKey)
          : null,
    };
  });
}

export async function provisionStagedOnboardingPackage(
  storagePath: string,
  expectedPackageSha256: string,
  confirmation: string,
) {
  const operator = await requirePlatformOperator();
  assertOperatorPackagePath(operator.userId, storagePath);
  await requireTrackedPackage(operator.userId, storagePath, ["preflight_passed"]);
  if (!/^[a-f0-9]{64}$/.test(expectedPackageSha256)) {
    throw new Error("A valid reviewed package hash is required.");
  }
  let completed = false;
  try {
    const receipt = await withStagedWorkspacePackage(storagePath, async (directory) => {
      const preflight = await preflightWorkspacePackage(directory);
      if (!preflight.ok || !preflight.prepared) {
        throw new Error(`Package no longer passes preflight: ${preflight.issues.map((issue) => issue.message).join("; ")}`);
      }
      if (preflight.prepared.blueprintSha256 !== expectedPackageSha256) {
        throw new Error("The staged package changed after preflight. Upload and review it again.");
      }
      const environment = checkOnboardingEnvironment(
        currentOnboardingEnvironmentInput({
          workspaceKey: preflight.prepared.blueprint.workspace.key,
          confirmation,
        }),
      );
      if (!environment.ok || !environment.target) throw new Error(environment.errors.join("\n"));
      const origin = await requestOrigin();
      return provisionWorkspace({
        environment: environment.target,
        package: preflight.prepared,
        repository: createSupabaseOnboardingRepository(),
        operatorUserId: operator.userId,
        operatorEmail: operator.email,
        setupRedirectTo: origin ? `${origin}/welcome` : undefined,
      });
    });
    completed = true;
    return receipt;
  } finally {
    const admin = createAdminClient();
    await admin.storage.from("onboarding-packages").remove([storagePath]);
    await admin
      .from("onboarding_package_uploads")
      .update({
        status: completed ? "consumed" : "discarded",
        consumed_at: new Date().toISOString(),
      })
      .eq("storage_path", storagePath);
  }
}

export async function discardStagedOnboardingPackage(storagePath: string) {
  const operator = await requirePlatformOperator();
  assertOperatorPackagePath(operator.userId, storagePath);
  const { error } = await createAdminClient().storage.from("onboarding-packages").remove([storagePath]);
  if (error) throw new Error(`Could not discard package: ${error.message}`);
  await createAdminClient()
    .from("onboarding_package_uploads")
    .update({ status: "discarded", consumed_at: new Date().toISOString() })
    .eq("storage_path", storagePath);
  return { ok: true };
}
