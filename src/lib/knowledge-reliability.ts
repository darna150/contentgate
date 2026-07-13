export type RetrievedKnowledgeParagraph = {
  document_id: string;
  document_title: string;
  paragraph_n: number;
  paragraph_text: string;
  relevance?: number;
};

export type RawKnowledgeCitation = {
  document_id?: unknown;
  paragraph_n?: unknown;
  excerpt?: unknown;
};

export type VerifiedKnowledgeCitation = {
  document_id: string;
  document_title: string;
  paragraph_n: number;
  excerpt: string;
};

const SAFE_NO_EVIDENCE_ANSWER =
  "I could not verify an answer in the approved source documents.";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function evidenceKey(documentId: string, paragraphNumber: number) {
  return `${documentId}:${paragraphNumber}`;
}

export function normalizeRetrievedParagraphs(
  rows: readonly Partial<RetrievedKnowledgeParagraph>[]
): RetrievedKnowledgeParagraph[] {
  const seen = new Set<string>();

  return rows.flatMap((row) => {
    const documentId = typeof row.document_id === "string" ? row.document_id : "";
    const documentTitle =
      typeof row.document_title === "string"
        ? normalizeWhitespace(row.document_title)
        : "";
    const paragraphNumber = Number(row.paragraph_n);
    const paragraphText =
      typeof row.paragraph_text === "string"
        ? normalizeWhitespace(row.paragraph_text)
        : "";

    if (
      !documentId ||
      !documentTitle ||
      !Number.isInteger(paragraphNumber) ||
      paragraphNumber < 1 ||
      !paragraphText
    ) {
      return [];
    }

    const key = evidenceKey(documentId, paragraphNumber);
    if (seen.has(key)) return [];
    seen.add(key);

    return [
      {
        document_id: documentId,
        document_title: documentTitle,
        paragraph_n: paragraphNumber,
        paragraph_text: paragraphText,
        relevance:
          typeof row.relevance === "number" && Number.isFinite(row.relevance)
            ? row.relevance
            : undefined,
      },
    ];
  });
}

export function buildKnowledgeContext(
  evidence: readonly RetrievedKnowledgeParagraph[]
) {
  return evidence
    .map(
      (paragraph) =>
        `[document_id=${paragraph.document_id} paragraph=${paragraph.paragraph_n}]\n` +
        `${paragraph.document_title}\n${paragraph.paragraph_text}`
    )
    .join("\n\n");
}

export function verifyKnowledgeCitations(
  citations: readonly RawKnowledgeCitation[],
  evidence: readonly RetrievedKnowledgeParagraph[]
): VerifiedKnowledgeCitation[] {
  const evidenceByKey = new Map(
    evidence.map((paragraph) => [
      evidenceKey(paragraph.document_id, paragraph.paragraph_n),
      paragraph,
    ])
  );
  const seen = new Set<string>();

  return citations.flatMap((citation) => {
    const documentId =
      typeof citation.document_id === "string" ? citation.document_id : "";
    const paragraphNumber = Number(citation.paragraph_n);
    const excerpt =
      typeof citation.excerpt === "string"
        ? normalizeWhitespace(citation.excerpt)
        : "";
    if (!documentId || !Number.isInteger(paragraphNumber) || !excerpt) return [];

    const key = evidenceKey(documentId, paragraphNumber);
    const paragraph = evidenceByKey.get(key);
    if (!paragraph || seen.has(key)) return [];

    const sourceText = normalizeWhitespace(paragraph.paragraph_text).toLocaleLowerCase();
    if (!sourceText.includes(excerpt.toLocaleLowerCase())) return [];

    seen.add(key);
    return [
      {
        document_id: paragraph.document_id,
        document_title: paragraph.document_title,
        paragraph_n: paragraph.paragraph_n,
        excerpt,
      },
    ];
  });
}

export function finalizeKnowledgeAnswer(input: {
  answer: unknown;
  notFound: unknown;
  citations: readonly VerifiedKnowledgeCitation[];
}) {
  const answer =
    typeof input.answer === "string" ? normalizeWhitespace(input.answer) : "";
  const unsupported = input.notFound !== true && input.citations.length === 0;
  const notFound = input.notFound === true || unsupported || !answer;

  return {
    answer: notFound ? SAFE_NO_EVIDENCE_ANSWER : answer,
    citations: notFound ? [] : [...input.citations],
    not_found: notFound,
  };
}
