import { randomBytes } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { importTemplateBundle, templateBundleStoragePrefix } from "../template-platform/importer";
import { buildProductTemplateAssignmentUpsert } from "../template-platform/publishing";
import { createSupabaseTemplateBundleRepository } from "../template-platform/supabase-repository";
import type {
  OnboardingCoreReport,
  OnboardingRepository,
  OnboardingRunStart,
  OnboardingUpload,
} from "./engine";

type ErrorLike = { message: string } | null;

function throwError(error: ErrorLike, action: string) {
  if (error) throw new Error(`${action}: ${error.message}`);
}

function firstRow<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function asCoreReport(value: unknown): OnboardingCoreReport {
  if (!value || typeof value !== "object") throw new Error("Onboarding returned an invalid receipt.");
  const report = value as Record<string, unknown>;
  return {
    organizationId: String(report.organizationId ?? ""),
    products: (report.products ?? {}) as Record<string, string>,
    campaigns: (report.campaigns ?? {}) as Record<string, string>,
    documents: (report.documents ?? {}) as Record<string, string>,
    claims: (report.claims ?? {}) as Record<string, string>,
    assets: (report.assets ?? {}) as Record<string, string>,
    templates: (report.templates ?? {}) as OnboardingCoreReport["templates"],
  };
}

export function createSupabaseOnboardingRepository(): OnboardingRepository {
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  return {
    async beginRun(input) {
      const { data, error } = await admin.rpc("begin_onboarding_run", {
        p_environment: input.environment,
        p_blueprint_sha256: input.blueprintSha256,
        p_blueprint: input.blueprint,
        p_operator_user_id: input.operatorUserId ?? null,
        p_operator_email: input.operatorEmail ?? null,
      });
      throwError(error, "Begin onboarding run");
      const row = firstRow(data as unknown as Array<{
        run_id: string;
        organization_id: string;
        run_status: OnboardingRunStart["status"];
        resumed: boolean;
      }> | null);
      if (!row) throw new Error("Begin onboarding run returned no run.");
      return {
        runId: row.run_id,
        organizationId: row.organization_id,
        status: row.run_status,
        resumed: row.resumed,
      };
    },

    async getCompletedReceipt(runId) {
      const { data, error } = await admin
        .from("onboarding_runs")
        .select("report")
        .eq("id", runId)
        .eq("status", "completed")
        .single();
      throwError(error, "Read completed onboarding receipt");
      return asCoreReport(data?.report);
    },

    async provisionUser(input) {
      const email = input.user.email.toLowerCase();
      const { data: directory, error: lookupError } = await admin.rpc(
        "find_onboarding_user_by_email",
        { p_email: email },
      );
      throwError(lookupError, "Look up Auth user");
      const existing = firstRow(directory as unknown as Array<{
        user_id: string;
        organization_id: string | null;
      }> | null);
      if (existing) {
        if (existing.organization_id !== input.organizationId) {
          throw new Error(`User ${email} already belongs to another workspace.`);
        }
        // A profile in this brand-new run's organization can only have been
        // created by an earlier attempt of this same run, so compensation owns it.
        return { userId: existing.user_id, createdByRun: true };
      }

      const { data: provisioningToken, error: provisionError } = await admin.rpc(
        "stage_onboarding_user",
        {
          p_run_id: input.runId,
          p_email: email,
          p_org_id: input.organizationId,
          p_role: input.user.role,
          p_full_name: input.user.fullName ?? null,
        },
      );
      throwError(provisionError, `Stage user ${email}`);
      if (typeof provisioningToken !== "string") {
        throw new Error(`Stage user ${email} returned no provisioning token.`);
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: randomBytes(32).toString("base64url"),
        email_confirm: true,
        user_metadata: {
          full_name: input.user.fullName ?? null,
          onboarding_token: provisioningToken,
        },
      });
      throwError(createError, `Create user ${email}`);
      if (!created.user) throw new Error(`Create user ${email} returned no user.`);
      return { userId: created.user.id, createdByRun: true };
    },

    async recordStep(input) {
      const { error } = await admin.rpc("record_onboarding_step", {
        p_run_id: input.runId,
        p_step_key: input.step,
        p_status: input.status,
        p_detail: input.detail ?? {},
        p_error_message: input.error ?? null,
      });
      throwError(error, `Record onboarding step ${input.step}`);
    },

    async upload(input: OnboardingUpload) {
      const { error } = await admin.storage.from(input.bucket).upload(input.path, input.data, {
        contentType: input.contentType,
        upsert: true,
      });
      throwError(error, `Upload ${input.bucket}/${input.path}`);
    },

    async removeUploads(uploads) {
      const byBucket = new Map<string, string[]>();
      for (const upload of uploads) {
        const paths = byBucket.get(upload.bucket) ?? [];
        paths.push(upload.path);
        byBucket.set(upload.bucket, paths);
      }
      for (const [bucket, paths] of byBucket) {
        if (paths.length === 0) continue;
        const { error } = await admin.storage.from(bucket).remove(paths);
        throwError(error, `Remove compensated ${bucket} uploads`);
      }
    },

    async applyCore(input) {
      const documents = input.documents.map((document) => ({
        key: document.key,
        content: document.content,
        paragraphs: document.paragraphs,
        fileType: document.fileType,
        storagePath: document.storagePath ?? null,
      }));
      const assets = input.assets.map((asset) => ({
        key: asset.key,
        storagePath: asset.storagePath,
        originalFileName: asset.originalFileName,
        mimeType: asset.mimeType,
        fileSizeBytes: asset.fileSizeBytes,
        widthPixels: asset.widthPixels,
        heightPixels: asset.heightPixels,
      }));
      const { data, error } = await admin.rpc("apply_onboarding_blueprint", {
        p_run_id: input.runId,
        p_uploader_id: input.uploaderId,
        p_resolved_documents: documents,
        p_resolved_assets: assets,
      });
      throwError(error, "Apply onboarding core data");
      return asCoreReport(data);
    },

    async installTemplateBundle(input) {
      const manifest = input.template.bundle.manifest;
      const prefix = templateBundleStoragePrefix({
        orgId: input.organizationId,
        manifest,
      });
      const storagePaths = manifest.assets.map((asset) => `${prefix}/${asset.path}`);
      let familyId: string;
      let versionId: string;
      try {
        const { data: existingFamily, error: familyError } = await admin
          .from("template_families")
          .select("id")
          .eq("org_id", input.organizationId)
          .eq("family_key", manifest.family.key)
          .maybeSingle();
        throwError(familyError, "Read template family");

        let existingVersion: { id: string; status: string } | null = null;
        if (existingFamily) {
          const result = await admin
            .from("template_versions")
            .select("id, status")
            .eq("org_id", input.organizationId)
            .eq("family_id", existingFamily.id)
            .eq("version_label", manifest.version.name)
            .maybeSingle();
          throwError(result.error, "Read template version");
          existingVersion = result.data;
        }

        if (existingFamily && existingVersion) {
          familyId = existingFamily.id;
          versionId = existingVersion.id;
        } else {
          const imported = await importTemplateBundle(
            {
              manifest,
              assets: input.template.bundle.assets,
              orgId: input.organizationId,
              createdBy: input.createdBy,
              storagePrefix: prefix,
            },
            createSupabaseTemplateBundleRepository(admin as never),
          );
          if (!imported.ok) {
            throw new Error(
              `Template ${input.template.key} failed validation: ${imported.issues.map((issue) => issue.message).join("; ")}`,
            );
          }
          familyId = imported.value.rows.family.id;
          versionId = imported.value.rows.version.id;
        }

        const publishedAt = new Date().toISOString();
        const { error: versionError } = await admin
          .from("template_versions")
          .update({ status: "published", published_at: publishedAt })
          .eq("id", versionId)
          .eq("org_id", input.organizationId)
          .in("status", ["ready", "published"]);
        throwError(versionError, "Publish template version");
        const { error: familyUpdateError } = await admin
          .from("template_families")
          .update({ status: "active", updated_at: publishedAt })
          .eq("id", familyId)
          .eq("org_id", input.organizationId);
        throwError(familyUpdateError, "Activate template family");

        const assignmentIds: string[] = [];
        for (const productKey of input.template.assignToProducts) {
          const productId = input.productIds[productKey];
          if (!productId) throw new Error(`Template assignment references unresolved product ${productKey}.`);
          const assignment = buildProductTemplateAssignmentUpsert({
            orgId: input.organizationId,
            productId,
            templateFamilyId: familyId,
            templateVersionId: versionId,
            manifest,
          });
          if (!assignment.ok) throw new Error(assignment.reason);
          const { data: row, error } = await admin
            .from("product_template_assignments")
            .upsert(assignment.row, { onConflict: "org_id,product_id,template_family_id" })
            .select("id")
            .single();
          throwError(error, `Assign template to ${productKey}`);
          if (!row) throw new Error(`Assign template to ${productKey} returned no assignment.`);
          assignmentIds.push(row.id);
        }
        return { familyId, versionId, assignmentIds, storagePaths };
      } catch (error) {
        await admin.storage.from("template-bundles").remove(storagePaths);
        throw error;
      }
    },

    async completeRun(input) {
      const { error } = await admin.rpc("complete_onboarding_run", {
        p_run_id: input.runId,
        p_report: input.report,
      });
      throwError(error, "Complete onboarding run");
    },

    async markFailed(input) {
      const { error } = await admin.rpc("mark_onboarding_run_failed", {
        p_run_id: input.runId,
        p_step_key: input.step,
        p_error_message: input.error,
      });
      throwError(error, "Mark onboarding run failed");
    },

    async rollbackTenantData(runId) {
      const { error } = await admin.rpc("rollback_onboarding_run", { p_run_id: runId });
      throwError(error, "Roll back onboarding tenant data");
    },

    async deleteUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      throwError(error, `Delete compensated Auth user ${userId}`);
    },

    async sendSetupEmail(input) {
      const { error } = await admin.auth.resetPasswordForEmail(input.email, {
        ...(input.redirectTo ? { redirectTo: input.redirectTo } : {}),
      });
      throwError(error, `Send setup email to ${input.email}`);
    },
  };
}
