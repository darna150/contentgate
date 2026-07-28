export type Paragraph = { n: number; text: string };

const MAX_PARAGRAPH_CHARS = 1_400;

export function isKnowledgeHeading(value: string) {
  const line = value.trim();
  if (!line || line.length > 120 || line.includes("\n")) return false;
  if (/^#{1,6}\s+\S/.test(line)) return true;
  if (/^[A-Z][A-Z0-9 &/()'’-]{2,}$/.test(line) && /[A-Z]/.test(line)) return true;
  return /^[A-Z][^.!?]{1,100}:$/.test(line);
}

function splitLongBlock(block: string, maxChars = MAX_PARAGRAPH_CHARS): string[] {
  if (block.length <= maxChars) return [block];

  const units = block
    .split(/(?<=\.)\s+(?=[A-Z0-9])|\n(?=\s*(?:[-*•]|\d+[.)])\s+)/)
    .map((unit) => unit.trim())
    .filter(Boolean);
  if (units.length === 1) {
    const words = block.split(/\s+/);
    const chunks: string[] = [];
    let current = "";
    for (const word of words) {
      if (word.length > maxChars) {
        if (current) chunks.push(current);
        for (let offset = 0; offset < word.length; offset += maxChars) {
          chunks.push(word.slice(offset, offset + maxChars));
        }
        current = "";
        continue;
      }
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxChars && current) {
        chunks.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  const chunks: string[] = [];
  let current = "";
  for (const unit of units) {
    const candidate = current ? `${current}\n${unit}` : unit;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = unit;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks.flatMap((chunk) =>
    chunk.length > maxChars ? splitLongBlock(chunk, maxChars) : [chunk]
  );
}

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

// Splits source text into stable citation units. Headings are attached to the
// following block, lists stay intact where possible, and oversized extracted
// blocks are bounded so one embedding cannot swallow a whole page.
export function segmentParagraphs(text: string): Paragraph[] {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const structured: string[] = [];
  let pendingHeading = "";
  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 1 && isKnowledgeHeading(lines[0])) {
      if (pendingHeading) structured.push(pendingHeading);
      pendingHeading = lines[0];
      continue;
    }

    const value = pendingHeading ? `${pendingHeading}\n${lines.join("\n")}` : lines.join("\n");
    pendingHeading = "";
    structured.push(value);
  }
  if (pendingHeading) structured.push(pendingHeading);

  return structured
    .flatMap((block) => splitLongBlock(block))
    .map((block, index) => ({ n: index + 1, text: block }));
}
