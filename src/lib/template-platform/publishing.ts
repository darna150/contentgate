import type { TemplateBundleManifest } from "./manifest.ts";
import { resolveTemplateBundleRuntimeVariant } from "./runtime.ts";

export type TemplateVersionLifecycleStatus =
  | "draft"
  | "published"
  | "ready"
  | "retired"
  | "validating";

export type TemplatePlatformPublishDecision =
  | { ok: true; alreadyPublished: boolean }
  | { ok: false; reason: string };

export type ProductTemplateAssignmentUpsert = {
  org_id: string;
  product_id: string;
  template_family_id: string;
  template_version_id: string;
  status: "active";
  default_variant_key: string;
  generation_profile: Record<string, unknown>;
  default_payload: Record<string, unknown>;
  allowed_locales: string[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function decideTemplateVersionPublish(
  status: TemplateVersionLifecycleStatus
): TemplatePlatformPublishDecision {
  if (status === "published") return { ok: true, alreadyPublished: true };
  if (status === "ready") return { ok: true, alreadyPublished: false };
  return {
    ok: false,
    reason: `Template versions must be ready before publishing. Current status: ${status}.`,
  };
}

export function resolveAssignmentDefaultVariant(input: {
  manifest: TemplateBundleManifest;
  requestedDefaultVariantKey?: string | null;
}) {
  const fallbackVariantKey = input.manifest.variants[0]?.key;
  const defaultVariantKey = input.requestedDefaultVariantKey ?? fallbackVariantKey;
  if (!defaultVariantKey) {
    return { ok: false as const, reason: "Template version has no variants." };
  }

  const variant = resolveTemplateBundleRuntimeVariant(input.manifest, defaultVariantKey);
  if (!variant) {
    return {
      ok: false as const,
      reason: `Default variant "${defaultVariantKey}" is not present in this template version.`,
    };
  }

  return { ok: true as const, variantKey: defaultVariantKey };
}

export function buildProductTemplateAssignmentUpsert(input: {
  orgId: string;
  productId: string;
  templateFamilyId: string;
  templateVersionId: string;
  manifest: TemplateBundleManifest;
  defaultVariantKey?: string | null;
  generationProfile?: unknown;
  defaultPayload?: unknown;
  allowedLocales?: unknown;
}): { ok: true; row: ProductTemplateAssignmentUpsert } | { ok: false; reason: string } {
  const resolvedVariant = resolveAssignmentDefaultVariant({
    manifest: input.manifest,
    requestedDefaultVariantKey: input.defaultVariantKey,
  });
  if (!resolvedVariant.ok) return resolvedVariant;

  const allowedLocales =
    Array.isArray(input.allowedLocales) &&
    input.allowedLocales.every((locale) => typeof locale === "string" && locale.length > 0)
      ? input.allowedLocales
      : ["en"];

  return {
    ok: true,
    row: {
      org_id: input.orgId,
      product_id: input.productId,
      template_family_id: input.templateFamilyId,
      template_version_id: input.templateVersionId,
      status: "active",
      default_variant_key: resolvedVariant.variantKey,
      generation_profile: isPlainObject(input.generationProfile) ? input.generationProfile : {},
      default_payload: isPlainObject(input.defaultPayload) ? input.defaultPayload : {},
      allowed_locales: allowedLocales,
    },
  };
}
