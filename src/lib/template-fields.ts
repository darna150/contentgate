export type FieldLimit = {
  max_chars?: number;
  max_words?: number;
  max_lines?: number;
};

export type FieldLimits = Record<string, FieldLimit>;

export type FieldIssue = {
  type: "required" | "characters" | "words" | "lines";
  message: string;
};

function minDefined(a?: number, b?: number) {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

export function mergeFieldLimit(
  base: FieldLimit | undefined,
  frame: FieldLimit | undefined
): FieldLimit | undefined {
  if (!base && !frame) return undefined;
  return {
    max_chars: minDefined(base?.max_chars, frame?.max_chars),
    max_words: minDefined(base?.max_words, frame?.max_words),
    max_lines: minDefined(base?.max_lines, frame?.max_lines),
  };
}

export function mergeFieldLimits(base: FieldLimits, frame: FieldLimits | null): FieldLimits {
  if (!frame) return base;
  const merged: FieldLimits = { ...base };
  for (const key of new Set([...Object.keys(base), ...Object.keys(frame)])) {
    const limit = mergeFieldLimit(base[key], frame[key]);
    if (limit) merged[key] = limit;
  }
  return merged;
}

export function fieldLimitText(limit?: FieldLimit): string {
  if (!limit) return "No configured limit";
  const parts: string[] = [];
  if (limit.max_chars) parts.push(`${limit.max_chars} characters`);
  if (limit.max_words) parts.push(`${limit.max_words} words`);
  if (limit.max_lines) parts.push(`${limit.max_lines} lines`);
  return parts.length ? `Maximum ${parts.join(", ")}` : "No configured limit";
}

export function fitFieldValue(value: unknown, limit?: FieldLimit): string {
  let text = String(value ?? "").trim();
  if (limit?.max_lines) {
    text = text.split(/\r?\n/).slice(0, limit.max_lines).join("\n");
  }
  if (limit?.max_words) {
    text = text.split(/\s+/).slice(0, limit.max_words).join(" ");
  }
  if (limit?.max_chars && text.length > limit.max_chars) {
    text = text.slice(0, limit.max_chars).trimEnd();
  }
  return text;
}

export function fieldIssues(
  value: unknown,
  limit?: FieldLimit,
  required = true
): FieldIssue[] {
  const text = String(value ?? "");
  const issues: FieldIssue[] = [];
  const trimmed = text.trim();
  if (required && !trimmed) {
    issues.push({ type: "required", message: "Required field" });
  }
  if (limit?.max_chars && text.length > limit.max_chars) {
    issues.push({
      type: "characters",
      message: `${text.length - limit.max_chars} characters over`,
    });
  }
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  if (limit?.max_words && words > limit.max_words) {
    issues.push({
      type: "words",
      message: `${words - limit.max_words} words over`,
    });
  }
  const lines = text ? text.split(/\r?\n/).length : 0;
  if (limit?.max_lines && lines > limit.max_lines) {
    issues.push({
      type: "lines",
      message: `${lines - limit.max_lines} lines over`,
    });
  }
  return issues;
}

export function templateFieldIssues(
  fields: Record<string, unknown>,
  order: string[],
  limits: FieldLimits
): Record<string, FieldIssue[]> {
  return Object.fromEntries(
    order
      .map((key) => [key, fieldIssues(fields[key], limits[key])] as const)
      .filter(([, issues]) => issues.length > 0)
  );
}

export function fitTemplateFields(
  fields: Record<string, unknown>,
  order: string[],
  limits: FieldLimits
): Record<string, string> {
  return Object.fromEntries(
    order.map((key) => [key, fitFieldValue(fields[key], limits[key])])
  );
}

export function fieldLimitInstruction(key: string, limit?: FieldLimit): string {
  if (!limit) return `- ${key}: concise copy`;
  const constraints: string[] = [];
  if (limit.max_chars) constraints.push(`maximum ${limit.max_chars} characters`);
  if (limit.max_words) constraints.push(`maximum ${limit.max_words} words`);
  if (limit.max_lines) constraints.push(`maximum ${limit.max_lines} lines`);
  return `- ${key}: ${constraints.join(", ")}`;
}
