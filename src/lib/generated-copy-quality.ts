// Fields that carry a command/label rather than a factual claim. Shared with
// evidence grounding so a field named `button`/`action` isn't held to a
// different standard by the two checks.
export const ACTION_FIELD_PATTERN = /\b(cta|call[_ -]?to[_ -]?action|button|action)\b/i;

const DANGLING_END_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "nor",
  "of",
  "on",
  "or",
  "so",
  "the",
  "to",
  "via",
  "while",
  "with",
  "without",
]);

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function terminalWord(value: string) {
  return value
    .replace(/[.!?…"')\]]+$/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .at(-1)
    ?.toLowerCase();
}

function hasBalancedPairs(value: string, open: string, close: string) {
  return value.split(open).length === value.split(close).length;
}

export function generatedCopyQualityIssues(
  fields: Record<string, unknown>,
  fieldOrder: readonly string[]
): Record<string, string[]> {
  return Object.fromEntries(
    fieldOrder
      .map((field) => {
        const text = cleanText(fields[field]);
        if (!text) return [field, []] as const;

        const issues: string[] = [];
        const isActionField = ACTION_FIELD_PATTERN.test(field);

        if (/[—–-]\s*$/.test(text)) {
          issues.push("ends with a dangling dash");
        }
        if (/[,;:]\s*$/.test(text)) {
          issues.push("ends with punctuation that implies more copy should follow");
        }
        if (/\b\w+-$/.test(text)) {
          issues.push("ends with a broken hyphenated word");
        }
        if (!hasBalancedPairs(text, "(", ")") || !hasBalancedPairs(text, "[", "]")) {
          issues.push("has an unclosed phrase");
        }

        const lastWord = terminalWord(text);
        if (!isActionField && lastWord && DANGLING_END_WORDS.has(lastWord)) {
          issues.push(`ends with dangling word "${lastWord}"`);
        }

        return [field, issues] as const;
      })
      .filter(([, issues]) => issues.length > 0)
  );
}

export function formatGeneratedCopyQualityIssues(
  issues: Record<string, string[]>
) {
  return Object.entries(issues).flatMap(([field, fieldIssues]) =>
    fieldIssues.map((issue) => `${field}: ${issue}`)
  );
}
