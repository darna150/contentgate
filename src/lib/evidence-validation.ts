const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "so",
  "that",
  "the",
  "their",
  "this",
  "to",
  "with",
]);

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function substantiveTokens(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function tokenOverlapRatio(a: string[], b: string[]) {
  if (!a.length || !b.length) return 0;
  const bSet = new Set(b);
  const overlap = new Set(a.filter((token) => bSet.has(token))).size;
  return overlap / Math.min(new Set(a).size, new Set(b).size);
}

function isLowRiskCommandField(field: string) {
  const normalized = normalize(field);
  return normalized.includes("cta") || normalized.includes("call action");
}

function fieldValueIsSupportedBySource(fieldValue: string, source: string) {
  const fieldTokens = substantiveTokens(fieldValue);
  if (fieldTokens.length < 3) return true;

  const sourceTokens = substantiveTokens(source);
  if (sourceTokens.length < 4) return false;

  const ratio = tokenOverlapRatio(fieldTokens, sourceTokens);
  return ratio >= 0.45 || normalize(source).includes(normalize(fieldValue));
}

export function evidenceSourceIsApproved(
  source: string,
  approvedSources: readonly string[]
) {
  const needle = normalize(source);
  const needleTokens = substantiveTokens(source);
  if (!needle || needleTokens.length < 4) return false;

  return approvedSources.some((approved) => {
    const haystack = normalize(approved);
    const haystackTokens = substantiveTokens(approved);
    if (!haystack || haystackTokens.length < 4) return false;

    const shorterTokenCount = Math.min(needleTokens.length, haystackTokens.length);
    const longerTokenCount = Math.max(needleTokens.length, haystackTokens.length);
    const lengthRatio = shorterTokenCount / longerTokenCount;

    if (
      shorterTokenCount >= 6 &&
      lengthRatio >= 0.45 &&
      (haystack.includes(needle) || needle.includes(haystack))
    ) {
      return true;
    }

    return (
      shorterTokenCount >= 8 &&
      lengthRatio >= 0.55 &&
      tokenOverlapRatio(needleTokens, haystackTokens) >= 0.8
    );
  });
}

export type GeneratedFieldEvidence = {
  field: string;
  approved_source: string;
};

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

    const supported = fieldEvidence.some(
      (item) =>
        evidenceSourceIsApproved(item.approved_source, input.approvedSources) &&
        fieldValueIsSupportedBySource(trimmed, item.approved_source)
    );
    if (!supported) {
      issues.push(`${field}: generated copy is not supported by its approved evidence.`);
    }
  }

  return issues;
}
