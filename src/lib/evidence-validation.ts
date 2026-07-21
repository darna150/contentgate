import { ACTION_FIELD_PATTERN } from "./generated-copy-quality.ts";

// Grounding is verified by proving the model's cited quote is a real, verbatim
// span of an approved source — not by lexically comparing the (possibly
// reworded or translated) generated field against the source. That older
// token-overlap check produced false rejections whenever a refinement reworded
// the copy ("More strategic", "Simpler") or generated a non-English variant,
// and it starved short approved claims. Verbatim containment is
// language-agnostic, rewording-proof, and re-verifiable at approval time.

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Language-agnostic: whitespace words of length >= 2, no stop-word list (a
// stop-word list would be English-only and re-break localized grounding).
function substantiveTokens(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 2);
}

// A quote grounds a field when it is a verbatim span of some approved source
// AND it is substantial: either it covers most of that source (a short claim
// quoted whole) or it carries at least four words (a real sentence fragment,
// not a generic 1-2 word snippet that could match almost anything). Returns the
// original approved source string that backed the quote, or null.
export function findGroundingSource(
  quote: string,
  approvedSources: readonly string[]
): string | null {
  const needle = normalize(quote);
  if (!needle) return null;
  const needleTokenCount = substantiveTokens(quote).length;
  if (needleTokenCount < 2) return null;

  for (const approved of approvedSources) {
    const haystack = normalize(approved);
    if (!haystack || !haystack.includes(needle)) continue;
    const coverage = needle.length / haystack.length;
    if (coverage >= 0.6 || needleTokenCount >= 4) return approved;
  }
  return null;
}

export function evidenceQuoteIsApproved(
  quote: string,
  approvedSources: readonly string[]
) {
  return findGroundingSource(quote, approvedSources) !== null;
}

export type GeneratedFieldEvidence = {
  field: string;
  // The fuller approved source text the quote came from. Kept for display and
  // backward compatibility with citations stored before `excerpt` existed.
  approved_source: string;
  // The verbatim quote the model pulled from an approved source. Preferred for
  // verification when present; falls back to `approved_source` for old rows.
  excerpt?: string;
  // Prompt-local source id (e.g. "C2", "P1") the model referenced. Not used for
  // verification and not persisted; retained so callers can pass model output
  // through without stripping it.
  source_id?: string;
};

// The span we verify: the verbatim excerpt when the model supplied one, else
// the whole approved_source (legacy citations that predate excerpts).
export function citationQuote(citation: GeneratedFieldEvidence): string {
  const excerpt =
    typeof citation.excerpt === "string" ? citation.excerpt.trim() : "";
  return excerpt || citation.approved_source;
}

function isLowRiskCommandField(field: string) {
  return ACTION_FIELD_PATTERN.test(field);
}

export function generatedCopyEvidenceIssues(input: {
  fields: Record<string, string>;
  evidence: readonly GeneratedFieldEvidence[];
  approvedSources: readonly string[];
}) {
  const issues: string[] = [];

  if (input.approvedSources.length === 0) {
    return ["No approved claims or source text are available for generation."];
  }

  for (const [field, value] of Object.entries(input.fields)) {
    const trimmed = value.trim();
    if (!trimmed || isLowRiskCommandField(field)) continue;

    const fieldEvidence = input.evidence.filter((item) => item.field === field);
    if (!fieldEvidence.length) {
      issues.push(`${field}: missing approved evidence.`);
      continue;
    }

    const grounded = fieldEvidence.some((item) =>
      evidenceQuoteIsApproved(citationQuote(item), input.approvedSources)
    );
    if (!grounded) {
      issues.push(
        `${field}: cited quote was not found verbatim in an approved source.`
      );
    }
  }

  return issues;
}
