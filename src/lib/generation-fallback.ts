import { graphemeCount } from "./graphemes.ts";
import type { Evidence } from "./templates.ts";

export type GenerationFallbackSource = {
  text: string;
};

export type GenerationFallbackCandidate = {
  fields: Record<string, string>;
  evidence: Evidence[];
};

/**
 * Produce deterministic, extractive candidates from approved material.
 * Required fields receive approved source text and optional fields stay blank;
 * the caller must still run quality, evidence, and real-layout validation.
 */
export function sourceBackedFallbackCandidates(input: {
  editableFields: readonly string[];
  requiredFields: readonly string[];
  sources: readonly GenerationFallbackSource[];
  maximumCandidates?: number;
}): GenerationFallbackCandidate[] {
  if (!input.sources.length) return [];
  const required = new Set(input.requiredFields);
  const sources = [...input.sources].sort(
    (left, right) => graphemeCount(left.text) - graphemeCount(right.text)
  );
  const candidateCount = Math.min(
    sources.length,
    Math.max(1, input.maximumCandidates ?? 12)
  );

  return Array.from({ length: candidateCount }, (_, seed) => {
    const fields: Record<string, string> = {};
    const evidence: Evidence[] = [];
    input.editableFields.forEach((field, index) => {
      if (!required.has(field)) {
        fields[field] = "";
        return;
      }
      const source = sources[(seed + index) % sources.length];
      fields[field] = source.text;
      evidence.push({
        field,
        approved_source: source.text,
        excerpt: source.text,
      });
    });
    return { fields, evidence };
  });
}
