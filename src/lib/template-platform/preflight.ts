import {
  validateTemplateBundleManifest,
  type TemplateBundleField,
  type TemplateBundleIssue,
  type TemplateBundleManifest,
} from "./manifest.ts";
import { validateTemplateBundlePublishReadiness } from "./publish-readiness.ts";
import {
  formatTemplatePlatformFitIssues,
  templatePlatformFieldFitIssues,
} from "./fit.ts";
import { getTemplateBundleVariantFields } from "./runtime.ts";

export type TemplateBundlePreflightSample = {
  key: string;
  label?: string;
  fields: Record<string, unknown>;
};

export type TemplateBundlePreflightReport = {
  ok: boolean;
  manifestKey: string;
  versionName: string;
  checkedAt: string;
  issues: TemplateBundleIssue[];
  variantCount: number;
  sampleCount: number;
};

function issue(
  code: TemplateBundleIssue["code"],
  path: string,
  message: string,
  severity: TemplateBundleIssue["severity"] = "error"
): TemplateBundleIssue {
  return { code, path, message, severity };
}

function sampleValueForField(field: TemplateBundleField) {
  if (field.defaultValue != null) return field.defaultValue;
  switch (field.type) {
    case "asset_choice":
    case "image":
      return "";
    case "boolean":
      return false;
    case "date":
      return "2026-07-14";
    case "enum":
      return field.options?.[0] ?? "";
    case "number":
      return 1;
    case "text":
    default:
      return field.required ? field.label : "";
  }
}

function defaultSample(manifest: TemplateBundleManifest): TemplateBundlePreflightSample {
  return {
    key: "manifest-defaults",
    label: "Manifest defaults",
    fields: Object.fromEntries(
      manifest.fields.map((field) => [field.key, sampleValueForField(field)])
    ),
  };
}

function missingRequiredFieldIssues(input: {
  manifest: TemplateBundleManifest;
  sample: TemplateBundlePreflightSample;
  sampleIndex: number;
}) {
  return input.manifest.fields.flatMap((field, fieldIndex) => {
    if (!field.required) return [];
    const value = input.sample.fields[field.key];
    const missing =
      value == null || (typeof value === "string" && value.trim().length === 0);
    return missing
      ? [
          issue(
            "publish_gate",
            `samples.${input.sampleIndex}.fields.${field.key}`,
            `Required field "${field.key}" is missing in sample "${input.sample.key}" (manifest field index ${fieldIndex}).`
          ),
        ]
      : [];
  });
}

export async function preflightTemplateBundle(input: {
  manifest: TemplateBundleManifest;
  samples?: readonly TemplateBundlePreflightSample[];
  now?: Date;
}): Promise<TemplateBundlePreflightReport> {
  const samples = input.samples?.length
    ? [...input.samples]
    : [defaultSample(input.manifest)];
  const issues: TemplateBundleIssue[] = [
    ...validateTemplateBundleManifest(input.manifest),
    ...validateTemplateBundlePublishReadiness(input.manifest),
  ];

  for (const [sampleIndex, sample] of samples.entries()) {
    issues.push(
      ...missingRequiredFieldIssues({
        manifest: input.manifest,
        sample,
        sampleIndex,
      })
    );

    for (const [variantIndex, variant] of input.manifest.variants.entries()) {
      const visibleFields = new Set(
        getTemplateBundleVariantFields(input.manifest, variant.key).map(
          (field) => field.key
        )
      );
      const fields = Object.fromEntries(
        Object.entries(sample.fields).filter(([key]) => visibleFields.has(key))
      );
      const fitIssues = await templatePlatformFieldFitIssues({
        manifest: input.manifest,
        variantKey: variant.key,
        fields,
      });

      for (const message of formatTemplatePlatformFitIssues(fitIssues)) {
        issues.push(
          issue(
            "geometry",
            `samples.${sampleIndex}.variants.${variantIndex}`,
            `Sample "${sample.key}" does not fit variant "${variant.key}": ${message}`
          )
        );
      }
    }
  }

  return {
    ok: issues.every((item) => item.severity !== "error"),
    manifestKey: input.manifest.family.key,
    versionName: input.manifest.version.name,
    checkedAt: (input.now ?? new Date()).toISOString(),
    issues,
    variantCount: input.manifest.variants.length,
    sampleCount: samples.length,
  };
}

export function formatTemplateBundlePreflightReport(
  report: TemplateBundlePreflightReport
) {
  const header = `${report.ok ? "PASS" : "FAIL"} ${report.manifestKey}@${report.versionName}: ${report.variantCount} variant(s), ${report.sampleCount} sample(s), ${report.issues.length} issue(s)`;
  if (report.issues.length === 0) return header;
  return [
    header,
    ...report.issues.map(
      (item) => `- [${item.severity}] ${item.code} ${item.path}: ${item.message}`
    ),
  ].join("\n");
}
