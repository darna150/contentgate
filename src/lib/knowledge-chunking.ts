import { isKnowledgeHeading, type Paragraph } from "./paragraphs.ts";
import type { RetrievedKnowledgeParagraph } from "./knowledge-reliability.ts";

const NEIGHBOR_SNIPPET_CHARS = 360;

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sourceKey(documentId: string, paragraphNumber: number) {
  return `${documentId}:${paragraphNumber}`;
}

function headingFromParagraph(paragraph: Paragraph) {
  const [firstLine = ""] = paragraph.text.split("\n");
  return isKnowledgeHeading(firstLine) ? firstLine.trim() : "";
}

export function buildContextualEmbeddingInputs(
  title: string,
  paragraphs: readonly Paragraph[]
) {
  let currentHeading = "";
  return paragraphs.map((paragraph, index) => {
    const detectedHeading = headingFromParagraph(paragraph);
    if (detectedHeading) currentHeading = detectedHeading;
    const previous = paragraphs[index - 1]?.text;
    const next = paragraphs[index + 1]?.text;

    return [
      `Document: ${normalize(title) || "Approved source"}`,
      currentHeading ? `Section: ${normalize(currentHeading)}` : "",
      previous ? `Previous context: ${normalize(previous).slice(0, NEIGHBOR_SNIPPET_CHARS)}` : "",
      `Source paragraph ${paragraph.n}: ${normalize(paragraph.text)}`,
      next ? `Next context: ${normalize(next).slice(0, NEIGHBOR_SNIPPET_CHARS)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });
}

export function expandKnowledgeEvidenceWithNeighbors(input: {
  seeds: readonly RetrievedKnowledgeParagraph[];
  corpus: readonly RetrievedKnowledgeParagraph[];
  radius?: number;
  limit?: number;
}) {
  const radius = Math.min(Math.max(Math.trunc(input.radius ?? 1), 0), 2);
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 18), 1), 30);
  const corpusByKey = new Map(
    input.corpus.map((paragraph) => [
      sourceKey(paragraph.document_id, paragraph.paragraph_n),
      paragraph,
    ])
  );
  const seen = new Set<string>();
  const expanded: RetrievedKnowledgeParagraph[] = [];

  for (const seed of input.seeds) {
    for (let offset = -radius; offset <= radius; offset += 1) {
      const paragraphNumber = seed.paragraph_n + offset;
      if (paragraphNumber < 1) continue;
      const key = sourceKey(seed.document_id, paragraphNumber);
      const paragraph = corpusByKey.get(key) ?? (offset === 0 ? seed : undefined);
      if (!paragraph || seen.has(key)) continue;
      seen.add(key);
      expanded.push({
        ...paragraph,
        relevance:
          offset === 0
            ? seed.relevance ?? paragraph.relevance
            : typeof seed.relevance === "number"
              ? seed.relevance * 0.9
              : paragraph.relevance,
      });
      if (expanded.length >= limit) return expanded;
    }
  }

  return expanded;
}
