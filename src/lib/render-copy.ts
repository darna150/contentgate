export type CopyFit = {
  maxChars?: number;
  maxWords?: number;
  maxLines?: number;
  lineChars?: number;
};

export function pickCopy(fields: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

export function fitCopy(value: unknown, fit: CopyFit = {}): string {
  let lines = String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (fit.maxLines) {
    lines = lines.slice(0, fit.maxLines);
  }

  let text = lines.join("\n");

  if (fit.maxWords) {
    text = text.split(/\s+/).slice(0, fit.maxWords).join(" ");
  }

  if (fit.maxChars && text.length > fit.maxChars) {
    text = text.slice(0, fit.maxChars).trimEnd();
  }

  if (fit.lineChars && fit.maxLines) {
    const lines: string[] = [];
    let current = "";
    for (const sourceLine of text.split(/\r?\n/)) {
      for (const word of sourceLine.split(/\s+/).filter(Boolean)) {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= fit.lineChars) {
          current = next;
        } else {
          if (current) lines.push(current);
          current = word.length > fit.lineChars ? word.slice(0, fit.lineChars) : word;
        }
        if (lines.length === fit.maxLines) break;
      }
      if (lines.length === fit.maxLines) break;
      if (current) {
        lines.push(current);
        current = "";
      }
      if (lines.length === fit.maxLines) break;
    }
    if (current && lines.length < fit.maxLines) lines.push(current);
    return lines.join("\n");
  }

  return text;
}
