export type Paragraph = { n: number; text: string };

export function normalizeParagraphs(value: unknown): Paragraph[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<number>();
  return value.flatMap((item, index) => {
    const text =
      typeof item === "string"
        ? item.trim()
        : item && typeof item === "object" && "text" in item && typeof item.text === "string"
          ? item.text.trim()
          : "";
    const candidate =
      item && typeof item === "object" && "n" in item ? Number(item.n) : index + 1;
    const n = Number.isInteger(candidate) && candidate > 0 ? candidate : index + 1;
    if (!text || seen.has(n)) return [];
    seen.add(n);
    return [{ n, text }];
  });
}

// Splits document text into numbered paragraphs — the unit citations point at.
// Blank lines separate paragraphs; single newlines inside a paragraph are kept.
export function segmentParagraphs(text: string): Paragraph[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block, i) => ({ n: i + 1, text: block }));
}
