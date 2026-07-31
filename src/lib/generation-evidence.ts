import { generatedCopyEvidenceIssues, type GeneratedFieldEvidence } from "./evidence-validation.ts";
import type { TemplateBundleField } from "./template-platform/manifest.ts";

const LANGUAGE_TO_LOCALE: Record<string, string> = {
  English: "en",
  Filipino: "fil",
  Spanish: "es",
  Portuguese: "pt",
  Vietnamese: "vi",
  Thai: "th",
};

export type GenerationEvidenceGateResult =
  | {
      ok: true;
      warnings: string[];
    }
  | {
      ok: false;
      issues: string[];
    };

export function localeIsAllowedForGeneration(input: {
  language: string;
  allowedLocales: readonly string[];
}) {
  const locale = LANGUAGE_TO_LOCALE[input.language] ?? input.language.toLowerCase();
  return input.allowedLocales.includes(locale);
}

export function aiEditableTemplateFields(
  fields: readonly TemplateBundleField[]
): TemplateBundleField[] {
  return fields.filter((field) => field.type === "text" && field.source === "ai");
}

export function studioEditableTemplateFields(
  fields: readonly TemplateBundleField[]
): TemplateBundleField[] {
  return fields.filter(
    (field) =>
      field.type === "text" && (field.source === "ai" || field.source === "user")
  );
}

export function requiredEvidenceFieldKeys(
  fields: readonly TemplateBundleField[]
): string[] {
  return aiEditableTemplateFields(fields)
    .filter((field) => field.evidenceRequired !== false)
    .map((field) => field.key);
}

export function composeStructuredFieldsForGeneration(input: {
  allFieldKeys: readonly string[];
  aiFieldKeys: readonly string[];
  generatedFields: Record<string, string>;
  defaultFields: Record<string, string>;
  previousFields?: Record<string, string>;
}) {
  const aiFields = new Set(input.aiFieldKeys);
  return Object.fromEntries(
    input.allFieldKeys.map((key) => {
      const baseValue = input.previousFields?.[key] ?? input.defaultFields[key] ?? "";
      const nextValue = aiFields.has(key) ? input.generatedFields[key] ?? "" : baseValue;
      return [key, nextValue];
    })
  );
}

export function evidenceGateForGeneratedFields(input: {
  fields: Record<string, string>;
  requiredEvidenceFields: readonly string[];
  evidence: readonly GeneratedFieldEvidence[];
  approvedSources: readonly string[];
}): GenerationEvidenceGateResult {
  const scopedFields = Object.fromEntries(
    input.requiredEvidenceFields.map((field) => [field, input.fields[field] ?? ""])
  );
  const issues = generatedCopyEvidenceIssues({
    fields: scopedFields,
    evidence: input.evidence,
    approvedSources: input.approvedSources,
  });

  if (issues.length) return { ok: false, issues };
  return { ok: true, warnings: [] };
}
