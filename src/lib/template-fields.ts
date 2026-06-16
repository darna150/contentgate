export type FieldLimit = {
  max_chars?: number;
  max_words?: number;
  max_lines?: number;
};

export type FieldLimits = Record<string, FieldLimit>;

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
