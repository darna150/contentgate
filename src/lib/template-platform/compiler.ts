import { createHash, randomUUID } from "node:crypto";

import {
  TEMPLATE_BUNDLE_SCHEMA_VERSION,
  validateTemplateBundleManifest,
  type TemplateBundleAsset,
  type TemplateBundleIssue,
  type TemplateBundleManifest,
  type TemplateBundleVariant,
} from "./manifest.ts";
import { validateTemplateBundlePublishReadiness } from "./publish-readiness.ts";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type TemplatePlatformCompileOptions = {
  orgId: string;
  createdBy?: string | null;
  storagePrefix: string;
  now?: Date;
  ids?: {
    familyId?: string;
    versionId?: string;
    importRunId?: string;
    variantIds?: Record<string, string>;
    assetIds?: Record<string, string>;
  };
};

export type TemplateFamilyInsert = {
  id: string;
  org_id: string;
  family_key: string;
  name: string;
  description: string | null;
  status: "draft";
};

export type TemplateVersionInsert = {
  id: string;
  org_id: string;
  family_id: string;
  version_label: string;
  status: "ready";
  schema_version: typeof TEMPLATE_BUNDLE_SCHEMA_VERSION;
  source_provider: "figma" | "manual";
  source_file_key: string | null;
  source_version: string | null;
  manifest: TemplateBundleManifest;
  manifest_sha256: string;
  validation_report: TemplateValidationReport;
  created_by: string | null;
};

export type TemplateVariantInsert = {
  id: string;
  org_id: string;
  template_version_id: string;
  variant_key: string;
  label: string;
  channel: TemplateBundleVariant["channel"];
  width: number;
  height: number;
  field_keys: string[];
  slot_manifest: TemplateBundleVariant["slots"];
};

export type TemplateAssetInsert = {
  id: string;
  org_id: string;
  template_version_id: string;
  variant_id: string | null;
  asset_key: string;
  asset_kind: TemplateBundleAsset["kind"];
  storage_path: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  sha256: string;
};

export type TemplateImportRunInsert = {
  id: string;
  org_id: string;
  template_version_id: string;
  source_provider: "figma" | "manual";
  status: "ready";
  manifest_sha256: string;
  report: TemplateValidationReport;
  created_by: string | null;
};

export type TemplateValidationReport = {
  schemaVersion: typeof TEMPLATE_BUNDLE_SCHEMA_VERSION;
  checkedAt: string;
  manifestSha256: string;
  issues: TemplateBundleIssue[];
};

export type CompiledTemplateBundleImport = {
  manifestSha256: string;
  rows: {
    family: TemplateFamilyInsert;
    version: TemplateVersionInsert;
    variants: TemplateVariantInsert[];
    assets: TemplateAssetInsert[];
    importRun: TemplateImportRunInsert;
  };
};

export type TemplateBundleCompileResult =
  | { ok: true; value: CompiledTemplateBundleImport }
  | { ok: false; issues: TemplateBundleIssue[] };

function canonicalize(value: unknown): Json {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  if (typeof value !== "object") return null;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)])
  );
}

export function stableJsonSha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function normalizeStoragePrefix(prefix: string) {
  return prefix
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

function isPortableAssetPath(path: string) {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.split("/").includes("..")
  );
}

function safeStorageFileName(assetPath: string) {
  return assetPath
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.replace(/[^a-zA-Z0-9._-]+/g, "-") || "asset";
}

function storagePath(prefix: string, asset: TemplateBundleAsset) {
  return [
    normalizeStoragePrefix(prefix),
    "assets",
    asset.sha256,
    safeStorageFileName(asset.path),
  ].filter(Boolean).join("/");
}

function variantFieldKeys(variant: TemplateBundleVariant): string[] {
  return [...new Set(variant.slots.map((slot) => slot.field))];
}

function assetVariantKey(
  asset: TemplateBundleAsset,
  variants: readonly TemplateBundleVariant[]
) {
  const owner = variants.find(
    (variant) =>
      variant.referenceAsset === asset.key || variant.backgroundAsset === asset.key
  );
  return owner?.key ?? null;
}

function pathIssues(manifest: TemplateBundleManifest): TemplateBundleIssue[] {
  return manifest.assets.flatMap((asset, index) =>
    isPortableAssetPath(asset.path)
      ? []
      : [
          {
            code: "asset_shape" as const,
            path: `assets.${index}.path`,
            severity: "error" as const,
            message: "Asset path must be relative and cannot contain parent segments.",
          },
        ]
  );
}

export function compileTemplateBundleImport(
  manifest: TemplateBundleManifest,
  options: TemplatePlatformCompileOptions
): TemplateBundleCompileResult {
  const issues = [
    ...validateTemplateBundleManifest(manifest),
    ...validateTemplateBundlePublishReadiness(manifest),
    ...pathIssues(manifest),
  ];
  if (issues.some((item) => item.severity === "error")) {
    return { ok: false, issues };
  }

  const familyId = options.ids?.familyId ?? randomUUID();
  const versionId = options.ids?.versionId ?? randomUUID();
  const importRunId = options.ids?.importRunId ?? randomUUID();
  const checkedAt = (options.now ?? new Date()).toISOString();
  const manifestSha256 = stableJsonSha256(manifest);
  const validationReport: TemplateValidationReport = {
    schemaVersion: TEMPLATE_BUNDLE_SCHEMA_VERSION,
    checkedAt,
    manifestSha256,
    issues,
  };

  const variantIds = new Map(
    manifest.variants.map((variant) => [
      variant.key,
      options.ids?.variantIds?.[variant.key] ?? randomUUID(),
    ])
  );

  const family: TemplateFamilyInsert = {
    id: familyId,
    org_id: options.orgId,
    family_key: manifest.family.key,
    name: manifest.family.name,
    description: manifest.family.description ?? null,
    status: "draft",
  };

  const version: TemplateVersionInsert = {
    id: versionId,
    org_id: options.orgId,
    family_id: familyId,
    version_label: manifest.version.name,
    status: "ready",
    schema_version: TEMPLATE_BUNDLE_SCHEMA_VERSION,
    source_provider: manifest.version.source,
    source_file_key: manifest.version.sourceFileKey ?? null,
    source_version: manifest.version.sourceVersion ?? null,
    manifest,
    manifest_sha256: manifestSha256,
    validation_report: validationReport,
    created_by: options.createdBy ?? null,
  };

  const variants: TemplateVariantInsert[] = manifest.variants.map((variant) => ({
    id: variantIds.get(variant.key) ?? randomUUID(),
    org_id: options.orgId,
    template_version_id: versionId,
    variant_key: variant.key,
    label: variant.label,
    channel: variant.channel,
    width: variant.width,
    height: variant.height,
    field_keys: variantFieldKeys(variant),
    slot_manifest: variant.slots,
  }));

  const assets: TemplateAssetInsert[] = manifest.assets.map((asset) => {
    const ownerVariantKey = assetVariantKey(asset, manifest.variants);
    return {
      id: options.ids?.assetIds?.[asset.key] ?? randomUUID(),
      org_id: options.orgId,
      template_version_id: versionId,
      variant_id: ownerVariantKey ? variantIds.get(ownerVariantKey) ?? null : null,
      asset_key: asset.key,
      asset_kind: asset.kind,
      storage_path: storagePath(options.storagePrefix, asset),
      mime_type: asset.mimeType ?? null,
      width: asset.width ?? null,
      height: asset.height ?? null,
      sha256: asset.sha256,
    };
  });

  const importRun: TemplateImportRunInsert = {
    id: importRunId,
    org_id: options.orgId,
    template_version_id: versionId,
    source_provider: manifest.version.source,
    status: "ready",
    manifest_sha256: manifestSha256,
    report: validationReport,
    created_by: options.createdBy ?? null,
  };

  return {
    ok: true,
    value: {
      manifestSha256,
      rows: {
        family,
        version,
        variants,
        assets,
        importRun,
      },
    },
  };
}
