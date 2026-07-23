import { createHash, randomUUID } from "node:crypto";

import {
  compileTemplateBundleImport,
  stableJsonSha256,
  type CompiledTemplateBundleImport,
  type TemplateImportRunInsert,
  type TemplatePlatformCompileOptions,
  type TemplateValidationReport,
} from "./compiler.ts";
import {
  TEMPLATE_BUNDLE_SCHEMA_VERSION,
  type TemplateBundleAsset,
  type TemplateBundleIssue,
  type TemplateBundleManifest,
} from "./manifest.ts";

export const TEMPLATE_BUNDLE_STORAGE_BUCKET = "template-bundles" as const;

export type TemplateBundleAssetSource = {
  path: string;
  data: Uint8Array;
  contentType?: string;
};

export type TemplateBundleImportRequest = {
  manifest: TemplateBundleManifest;
  assets: readonly TemplateBundleAssetSource[];
  orgId: string;
  createdBy?: string | null;
  storagePrefix: string;
  now?: Date;
  ids?: TemplatePlatformCompileOptions["ids"];
};

export type FailedTemplateImportRunInsert = Omit<
  TemplateImportRunInsert,
  "status" | "template_version_id"
> & {
  template_version_id: null;
  status: "failed";
};

export type TemplateBundleImportRepository = {
  findTemplateFamilyId(input: {
    orgId: string;
    familyKey: string;
  }): Promise<string | null>;
  uploadTemplateAsset(input: {
    bucket: typeof TEMPLATE_BUNDLE_STORAGE_BUCKET;
    path: string;
    data: Uint8Array;
    contentType: string | null;
  }): Promise<void>;
  insertCompiledTemplateBundle(
    rows: CompiledTemplateBundleImport["rows"]
  ): Promise<void>;
  insertFailedTemplateImportRun(row: FailedTemplateImportRunInsert): Promise<void>;
};

export type TemplateBundleImportResult =
  | { ok: true; value: CompiledTemplateBundleImport }
  | { ok: false; issues: TemplateBundleIssue[] };

function issue(
  path: string,
  message: string,
  code: TemplateBundleIssue["code"] = "asset_shape"
): TemplateBundleIssue {
  return { code, path, severity: "error", message };
}

function bytesSha256(data: Uint8Array) {
  return createHash("sha256").update(data).digest("hex");
}

function safeStorageSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "bundle";
}

export function templateBundleStoragePrefix(input: {
  orgId: string;
  manifest: TemplateBundleManifest;
}) {
  return [
    input.orgId,
    "template-bundles",
    safeStorageSegment(input.manifest.family.key),
    safeStorageSegment(input.manifest.version.name),
  ].join("/");
}

export function templateBundleStoragePrefixIsOrgScoped(input: {
  orgId: string;
  storagePrefix: string;
}) {
  const normalized = input.storagePrefix.replace(/^\/+|\/+$/g, "");
  return (
    normalized === input.orgId ||
    normalized.startsWith(`${input.orgId}/`)
  );
}

function assetSourceByPath(sources: readonly TemplateBundleAssetSource[]) {
  return new Map(sources.map((source) => [source.path, source]));
}

export function validateTemplateBundleAssetPayloads(
  manifestAssets: readonly TemplateBundleAsset[],
  sources: readonly TemplateBundleAssetSource[]
) {
  const sourcesByPath = assetSourceByPath(sources);
  const issues: TemplateBundleIssue[] = [];

  manifestAssets.forEach((asset, index) => {
    const source = sourcesByPath.get(asset.path);
    if (!source) {
      issues.push(issue(`assets.${index}.path`, `Asset payload for "${asset.path}" is missing.`));
      return;
    }

    const actualHash = bytesSha256(source.data);
    if (actualHash !== asset.sha256) {
      issues.push(
        issue(
          `assets.${index}.sha256`,
          `Asset "${asset.path}" checksum mismatch. Expected ${asset.sha256}, received ${actualHash}.`
        )
      );
    }
  });

  return issues;
}

function importRunSource(manifest: TemplateBundleManifest) {
  return manifest.version?.source === "manual" ? "manual" : "figma";
}

function failedReport(input: {
  checkedAt: string;
  manifestSha256: string;
  issues: TemplateBundleIssue[];
}): TemplateValidationReport {
  return {
    schemaVersion: TEMPLATE_BUNDLE_SCHEMA_VERSION,
    checkedAt: input.checkedAt,
    manifestSha256: input.manifestSha256,
    issues: input.issues,
  };
}

async function recordFailedImport(input: {
  repository: TemplateBundleImportRepository;
  request: TemplateBundleImportRequest;
  manifestSha256: string;
  issues: TemplateBundleIssue[];
}) {
  const checkedAt = (input.request.now ?? new Date()).toISOString();
  const report = failedReport({
    checkedAt,
    manifestSha256: input.manifestSha256,
    issues: input.issues,
  });
  await input.repository.insertFailedTemplateImportRun({
    id: input.request.ids?.importRunId ?? randomUUID(),
    org_id: input.request.orgId,
    template_version_id: null,
    source_provider: importRunSource(input.request.manifest),
    status: "failed",
    manifest_sha256: input.manifestSha256,
    report,
    created_by: input.request.createdBy ?? null,
  });
}

export async function importTemplateBundle(
  request: TemplateBundleImportRequest,
  repository: TemplateBundleImportRepository
): Promise<TemplateBundleImportResult> {
  const existingFamilyId = await repository.findTemplateFamilyId({
    orgId: request.orgId,
    familyKey: request.manifest.family.key,
  });

  const compileResult = compileTemplateBundleImport(request.manifest, {
    orgId: request.orgId,
    createdBy: request.createdBy,
    storagePrefix: request.storagePrefix,
    now: request.now,
    ids: {
      ...request.ids,
      familyId: existingFamilyId ?? request.ids?.familyId,
    },
  });

  if (!compileResult.ok) {
    await recordFailedImport({
      repository,
      request,
      manifestSha256: stableJsonSha256(request.manifest),
      issues: compileResult.issues,
    });
    return compileResult;
  }

  const payloadIssues = validateTemplateBundleAssetPayloads(request.manifest.assets, request.assets);
  if (payloadIssues.length > 0) {
    await recordFailedImport({
      repository,
      request,
      manifestSha256: compileResult.value.manifestSha256,
      issues: payloadIssues,
    });
    return { ok: false, issues: payloadIssues };
  }

  const sourcesByPath = assetSourceByPath(request.assets);
  for (const asset of compileResult.value.rows.assets) {
    const manifestAsset = request.manifest.assets.find(
      (candidate) => candidate.key === asset.asset_key
    );
    const source = manifestAsset ? sourcesByPath.get(manifestAsset.path) : null;
    if (!source) {
      throw new Error(`Missing already validated asset payload for ${asset.asset_key}.`);
    }
    await repository.uploadTemplateAsset({
      bucket: TEMPLATE_BUNDLE_STORAGE_BUCKET,
      path: asset.storage_path,
      data: source.data,
      contentType: source.contentType ?? asset.mime_type,
    });
  }

  await repository.insertCompiledTemplateBundle(compileResult.value.rows);
  return compileResult;
}
