export type Paragraph = { n: number; text: string };

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
