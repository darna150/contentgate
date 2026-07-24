import type { TemplateBundleManifest } from "./manifest.ts";
import {
  getTemplateBundleSupportedSizes,
  resolveTemplateBundleRuntimeVariant,
} from "./runtime.ts";

export type TemplatePlatformAssignmentRow = {
  id: string;
  product_id: string;
  status: string;
  default_variant_key: string | null;
  generation_profile: unknown;
  default_payload: unknown;
  allowed_locales?: unknown;
  template_families: {
    id: string;
    family_key: string;
    name: string;
  } | { id: string; family_key: string; name: string }[] | null;
  template_versions: {
    id: string;
    version_label: string;
    status: string;
    manifest: TemplateBundleManifest;
  } | {
    id: string;
    version_label: string;
    status: string;
    manifest: TemplateBundleManifest;
  }[] | null;
};

export type TemplatePlatformAssignmentRuntime = {
  assignmentId: string;
  productId: string;
  familyId: string;
  familyKey: string;
  familyName: string;
  versionId: string;
  versionLabel: string;
  supportedSizes: string[];
  defaultVariantKey: string;
  manifest: TemplateBundleManifest;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function normalizeTemplatePlatformAssignment(
  row: TemplatePlatformAssignmentRow
): TemplatePlatformAssignmentRuntime | null {
  if (row.status !== "active") return null;
  const family = one(row.template_families);
  const version = one(row.template_versions);
  if (!family || !version || version.status !== "published") return null;

  const supportedSizes = getTemplateBundleSupportedSizes(version.manifest);
  if (supportedSizes.length === 0) return null;
  const defaultVariantKey = row.default_variant_key ?? supportedSizes[0];
  if (!resolveTemplateBundleRuntimeVariant(version.manifest, defaultVariantKey)) {
    return null;
  }

  return {
    assignmentId: row.id,
    productId: row.product_id,
    familyId: family.id,
    familyKey: family.family_key,
    familyName: family.name,
    versionId: version.id,
    versionLabel: version.version_label,
    supportedSizes,
    defaultVariantKey,
    manifest: version.manifest,
  };
}
