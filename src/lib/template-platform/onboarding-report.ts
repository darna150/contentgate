import type { TemplateBundlePreflightReport } from "./preflight.ts";
import type { TemplateBundleManifest } from "./manifest.ts";

export type TemplateOnboardingReport = {
  ok: boolean;
  familyKey: string;
  familyName: string;
  versionName: string;
  variants: Array<{ key: string; label: string; width: number; height: number }>;
  fields: Array<{
    key: string;
    type: string;
    source: string;
    required: boolean;
    damBinding?: string;
  }>;
  assetCount: number;
  damBoundFieldCount: number;
  preflightIssueCount: number;
  blockers: string[];
  warnings: string[];
  nextSteps: string[];
};

function damBindingSummary(field: TemplateBundleManifest["fields"][number]) {
  const binding = field.assetBinding;
  if (!binding) return undefined;
  return [
    binding.source,
    binding.scope ? `scope=${binding.scope}` : null,
    binding.mediaKind ? `media=${binding.mediaKind}` : null,
    binding.assetType ? `type=${binding.assetType}` : null,
    binding.category ? `category=${binding.category}` : null,
    binding.tags?.length ? `tags=${binding.tags.join(",")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function buildTemplateOnboardingReport(input: {
  manifest: TemplateBundleManifest;
  preflight: TemplateBundlePreflightReport;
}): TemplateOnboardingReport {
  const blockers = input.preflight.issues
    .filter((issue) => issue.severity === "error")
    .map((issue) => `${issue.path}: ${issue.message}`);
  const warnings = input.preflight.issues
    .filter((issue) => issue.severity !== "error")
    .map((issue) => `${issue.path}: ${issue.message}`);
  const damBoundFields = input.manifest.fields.filter(
    (field) => field.assetBinding?.source === "product_assets"
  );
  const variants = input.manifest.variants.map((variant) => ({
    key: variant.key,
    label: variant.label,
    width: variant.width,
    height: variant.height,
  }));
  const fields = input.manifest.fields.map((field) => ({
    key: field.key,
    type: field.type,
    source: field.source,
    required: field.required !== false,
    damBinding: damBindingSummary(field),
  }));

  return {
    ok: input.preflight.ok && blockers.length === 0,
    familyKey: input.manifest.family.key,
    familyName: input.manifest.family.name,
    versionName: input.manifest.version.name,
    variants,
    fields,
    assetCount: input.manifest.assets.length,
    damBoundFieldCount: damBoundFields.length,
    preflightIssueCount: input.preflight.issues.length,
    blockers,
    warnings,
    nextSteps: [
      "Import the bundle with POST /api/template-bundles/import or the approved admin import script.",
      "Publish the imported ready version with POST /api/template-bundles/publish.",
      "Create or update the product's active platform assignment pinned to the published version.",
      damBoundFields.length
        ? "Upload and approve matching brand/product assets in the Asset Library before Studio QA."
        : "No DAM-bound fields were declared; Studio should not show DAM asset pickers for this template.",
      "Generate one draft per variant, verify live preview, draft preview, approval gate, and approved export.",
    ],
  };
}

export function formatTemplateOnboardingReport(report: TemplateOnboardingReport) {
  const lines = [
    `# Template onboarding report: ${report.familyKey}@${report.versionName}`,
    "",
    report.ok ? "Status: PASS" : "Status: BLOCKED",
    "",
    `Variants: ${report.variants.length}`,
    ...report.variants.map(
      (variant) =>
        `- ${variant.key} (${variant.label}) — ${variant.width}×${variant.height}`
    ),
    "",
    `Fields: ${report.fields.length}`,
    ...report.fields.map((field) => {
      const required = field.required ? "required" : "optional";
      const binding = field.damBinding ? ` — DAM: ${field.damBinding}` : "";
      return `- ${field.key} — ${field.type}/${field.source}/${required}${binding}`;
    }),
    "",
    `Assets: ${report.assetCount}`,
    `DAM-bound fields: ${report.damBoundFieldCount}`,
    `Preflight issues: ${report.preflightIssueCount}`,
    "",
    "## Blockers",
    ...(report.blockers.length ? report.blockers.map((item) => `- ${item}`) : ["- None"]),
    "",
    "## Warnings",
    ...(report.warnings.length ? report.warnings.map((item) => `- ${item}`) : ["- None"]),
    "",
    "## Next steps",
    ...report.nextSteps.map((item) => `- ${item}`),
    "",
  ];
  return lines.join("\n");
}
