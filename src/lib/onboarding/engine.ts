import type { WorkspaceBlueprint } from "./blueprint.ts";
import type {
  PreparedAsset,
  PreparedDocument,
  PreparedTemplateBundle,
  PreparedWorkspacePackage,
} from "./package.ts";

export type OnboardingRunStatus =
  | "provisioning"
  | "completed"
  | "failed"
  | "rolling_back"
  | "rolled_back";

export type OnboardingRunStart = {
  runId: string;
  organizationId: string;
  status: OnboardingRunStatus;
  resumed: boolean;
};

export type ProvisionedUser = {
  userId: string;
  createdByRun: boolean;
};

export type OnboardingUpload = {
  bucket: "documents" | "product-assets" | "template-bundles";
  path: string;
  data: Uint8Array;
  contentType: string;
};

export type OnboardingCoreReport = {
  organizationId: string;
  products: Record<string, string>;
  campaigns: Record<string, string>;
  documents: Record<string, string>;
  claims: Record<string, string>;
  assets: Record<string, string>;
  templates?: Record<string, OnboardingTemplateReport>;
};

export type OnboardingTemplateReport = {
  familyId: string;
  versionId: string;
  assignmentIds: string[];
  storagePaths: string[];
};

export type OnboardingReceipt = OnboardingCoreReport & {
  runId: string;
  workspaceKey: string;
  blueprintSha256: string;
  status: "completed";
  resumed: boolean;
  setupEmails: Array<{ email: string; sent: boolean; error?: string }>;
  qaEnvironment: Record<string, string>;
};

function qaEnvironment(
  blueprint: WorkspaceBlueprint,
  products: Record<string, string>,
  templates: Record<string, OnboardingTemplateReport> = {},
) {
  const qa = blueprint.qa;
  if (!qa) return {};
  const product = blueprint.products.find((entry) => entry.key === qa.productKey);
  const bundle = qa.templateBundleKey
    ? blueprint.templateBundles?.find((entry) => entry.key === qa.templateBundleKey)
    : blueprint.templateBundles?.find((entry) => entry.assignToProducts.includes(qa.productKey));
  const assignmentIndex = bundle?.assignToProducts.indexOf(qa.productKey) ?? -1;
  const assignmentId =
    bundle && assignmentIndex >= 0
      ? templates[bundle.key]?.assignmentIds[assignmentIndex]
      : undefined;
  return Object.fromEntries(
    Object.entries({
      CONTENTGATE_E2E_PRODUCT_ID: products[qa.productKey],
      CONTENTGATE_E2E_PRODUCT_NAME: product?.name,
      CONTENTGATE_E2E_ASSIGNMENT_ID: assignmentId,
      CONTENTGATE_E2E_TEMPLATE_NAME: qa.templateName,
      CONTENTGATE_E2E_OUTPUT_SIZE_KEY: qa.outputSizeKey,
      CONTENTGATE_E2E_OUTPUT_SIZE_LABEL: qa.outputSizeLabel,
      CONTENTGATE_E2E_OUTPUT_WIDTH: qa.outputWidth?.toString(),
      CONTENTGATE_E2E_OUTPUT_HEIGHT: qa.outputHeight?.toString(),
      CONTENTGATE_E2E_KNOWLEDGE_QUESTION: qa.knowledgeQuestion,
    }).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0),
  );
}

export interface OnboardingRepository {
  beginRun(input: {
    environment: "development" | "staging" | "production";
    blueprintSha256: string;
    blueprint: WorkspaceBlueprint;
    operatorUserId?: string | null;
    operatorEmail?: string | null;
  }): Promise<OnboardingRunStart>;
  getCompletedReceipt(runId: string): Promise<OnboardingCoreReport>;
  provisionUser(input: {
    runId: string;
    organizationId: string;
    user: WorkspaceBlueprint["users"][number];
  }): Promise<ProvisionedUser>;
  recordStep(input: {
    runId: string;
    step: string;
    status: "running" | "completed" | "failed" | "compensated";
    detail?: Record<string, unknown>;
    error?: string;
  }): Promise<void>;
  upload(input: OnboardingUpload): Promise<void>;
  removeUploads(uploads: Array<Pick<OnboardingUpload, "bucket" | "path">>): Promise<void>;
  applyCore(input: {
    runId: string;
    uploaderId: string;
    documents: Array<PreparedDocument & { storagePath?: string }>;
    assets: Array<Omit<PreparedAsset, "data"> & { storagePath: string }>;
  }): Promise<OnboardingCoreReport>;
  installTemplateBundle(input: {
    runId: string;
    organizationId: string;
    createdBy: string;
    productIds: Record<string, string>;
    template: PreparedTemplateBundle;
  }): Promise<{ familyId: string; versionId: string; assignmentIds: string[]; storagePaths: string[] }>;
  completeRun(input: { runId: string; report: Record<string, unknown> }): Promise<void>;
  markFailed(input: { runId: string; step: string; error: string }): Promise<void>;
  rollbackTenantData(runId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  sendSetupEmail(input: { email: string; redirectTo?: string }): Promise<void>;
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function provisionWorkspace(input: {
  environment: "development" | "staging" | "production";
  package: PreparedWorkspacePackage;
  repository: OnboardingRepository;
  operatorUserId?: string | null;
  operatorEmail?: string | null;
  setupRedirectTo?: string;
}): Promise<OnboardingReceipt> {
  const started = await input.repository.beginRun({
    environment: input.environment,
    blueprintSha256: input.package.blueprintSha256,
    blueprint: input.package.blueprint,
    operatorUserId: input.operatorUserId,
    operatorEmail: input.operatorEmail,
  });
  if (started.status === "completed") {
    const report = await input.repository.getCompletedReceipt(started.runId);
    return {
      ...report,
      runId: started.runId,
      workspaceKey: input.package.blueprint.workspace.key,
      blueprintSha256: input.package.blueprintSha256,
      status: "completed",
      resumed: true,
      setupEmails: [],
      qaEnvironment: qaEnvironment(input.package.blueprint, report.products, report.templates),
    };
  }
  if (started.status === "rolled_back") {
    throw new Error("This exact package was rolled back. Change the blueprint before creating a new run.");
  }

  const createdUserIds: string[] = [];
  const uploads: OnboardingUpload[] = [];
  let activeStep = "users";
  try {
    const users = new Map<string, ProvisionedUser>();
    for (const user of input.package.blueprint.users) {
      activeStep = `user:${user.key}`;
      const provisioned = await input.repository.provisionUser({
        runId: started.runId,
        organizationId: started.organizationId,
        user,
      });
      users.set(user.key, provisioned);
      if (provisioned.createdByRun) createdUserIds.push(provisioned.userId);
      await input.repository.recordStep({
        runId: started.runId,
        step: activeStep,
        status: "completed",
        detail: provisioned,
      });
    }
    const uploader = [...users.entries()].find(([key]) =>
      input.package.blueprint.users.some((user) => user.key === key && user.role === "admin"),
    )?.[1];
    if (!uploader) throw new Error("Provisioning did not produce a workspace admin profile.");

    activeStep = "uploads";
    const resolvedDocuments: Array<PreparedDocument & { storagePath?: string }> = [];
    for (const document of input.package.documents) {
      if (!document.upload) {
        resolvedDocuments.push(document);
        continue;
      }
      const path = `${started.organizationId}/onboarding/${started.runId}/documents/${safeSegment(document.key)}-${safeSegment(document.upload.fileName)}`;
      const upload = { bucket: "documents" as const, path, data: document.upload.data, contentType: document.upload.contentType };
      await input.repository.upload(upload);
      uploads.push(upload);
      resolvedDocuments.push({ ...document, storagePath: path });
    }
    const resolvedAssets: Array<Omit<PreparedAsset, "data"> & { storagePath: string }> = [];
    for (const asset of input.package.assets) {
      const path = `${started.organizationId}/onboarding/${started.runId}/assets/${safeSegment(asset.key)}-${safeSegment(asset.originalFileName)}`;
      const upload = { bucket: "product-assets" as const, path, data: asset.data, contentType: asset.mimeType };
      await input.repository.upload(upload);
      uploads.push(upload);
      resolvedAssets.push({
        key: asset.key,
        originalFileName: asset.originalFileName,
        mimeType: asset.mimeType,
        fileSizeBytes: asset.fileSizeBytes,
        widthPixels: asset.widthPixels,
        heightPixels: asset.heightPixels,
        storagePath: path,
      });
    }
    await input.repository.recordStep({
      runId: started.runId,
      step: activeStep,
      status: "completed",
      detail: { paths: uploads.map(({ bucket, path }) => ({ bucket, path })) },
    });

    activeStep = "core_data";
    const core = await input.repository.applyCore({
      runId: started.runId,
      uploaderId: uploader.userId,
      documents: resolvedDocuments,
      assets: resolvedAssets,
    });

    const templates: Record<string, OnboardingTemplateReport> = {};
    for (const template of input.package.templateBundles) {
      activeStep = `template:${template.key}`;
      templates[template.key] = await input.repository.installTemplateBundle({
        runId: started.runId,
        organizationId: started.organizationId,
        createdBy: uploader.userId,
        productIds: core.products,
        template,
      });
      const templateResult = templates[template.key];
      for (const path of templateResult.storagePaths) {
        uploads.push({
          bucket: "template-bundles",
          path,
          data: new Uint8Array(),
          contentType: "application/octet-stream",
        });
      }
      await input.repository.recordStep({
        runId: started.runId,
        step: activeStep,
        status: "completed",
        detail: templates[template.key] as unknown as Record<string, unknown>,
      });
    }

    activeStep = "complete";
    await input.repository.completeRun({
      runId: started.runId,
      report: { templates },
    });

    const setupEmails = [] as OnboardingReceipt["setupEmails"];
    for (const user of input.package.blueprint.users) {
      try {
        await input.repository.sendSetupEmail({ email: user.email, redirectTo: input.setupRedirectTo });
        setupEmails.push({ email: user.email, sent: true });
      } catch (error) {
        setupEmails.push({ email: user.email, sent: false, error: errorMessage(error) });
      }
    }

    return {
      ...core,
      runId: started.runId,
      workspaceKey: input.package.blueprint.workspace.key,
      blueprintSha256: input.package.blueprintSha256,
      status: "completed",
      resumed: started.resumed,
      setupEmails,
      qaEnvironment: qaEnvironment(input.package.blueprint, core.products, templates),
    };
  } catch (error) {
    const message = errorMessage(error);
    await input.repository.markFailed({ runId: started.runId, step: activeStep, error: message }).catch(() => undefined);
    await input.repository.rollbackTenantData(started.runId).catch(() => undefined);
    await input.repository.removeUploads(uploads.map(({ bucket, path }) => ({ bucket, path }))).catch(() => undefined);
    for (const userId of createdUserIds.reverse()) {
      await input.repository.deleteUser(userId).catch(() => undefined);
    }
    await input.repository.rollbackTenantData(started.runId).catch(() => undefined);
    throw new Error(`Onboarding failed at ${activeStep}: ${message}`);
  }
}
