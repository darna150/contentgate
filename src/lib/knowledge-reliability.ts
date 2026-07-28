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

export type RawKnowledgeClaim = {
  text?: unknown;
  citations?: unknown;
};

export type VerifiedKnowledgeCitation = {
  document_id: string;
  document_title: string;
  paragraph_n: number;
  excerpt: string;
};

export type VerifiedKnowledgeClaim = {
  text: string;
  citations: VerifiedKnowledgeCitation[];
};

const SAFE_NO_EVIDENCE_ANSWER =
  "I could not verify an answer in the approved source documents.";
const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "can",
  "for",
  "from",
  "has",
  "how",
  "into",
  "its",
  "the",
  "their",
  "this",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "your",
]);

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function tokens(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length > 2 && !STOP_WORDS.has(token)) ?? [];
}

function evidenceKey(documentId: string, paragraphNumber: number) {
  return `${documentId}:${paragraphNumber}`;
}

const NUMERIC_TOKEN = /\b\d+(?:[.,]\d+)?\b/g;
const RISK_PHRASES = ["at least", "at most", "more than", "less than", "up to", "only", "never", "not"];

export function hasDeterministicClaimSupport(
  claim: string,
  citations: readonly VerifiedKnowledgeCitation[]
) {
  const normalizedClaim = normalizeWhitespace(claim).toLocaleLowerCase();
  const evidence = citations
    .map((citation) => normalizeWhitespace(citation.excerpt).toLocaleLowerCase())
    .join(" ");
  const claimNumbers = normalizedClaim.match(NUMERIC_TOKEN) ?? [];
  if (claimNumbers.some((number) => !evidence.includes(number))) return false;
  return RISK_PHRASES.every(
    (phrase) => !normalizedClaim.includes(phrase) || evidence.includes(phrase)
  );
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

export function rankKnowledgeEvidence(
  question: string,
  evidence: readonly RetrievedKnowledgeParagraph[],
  limit = 12
) {
  const questionTokens = tokens(question);
  if (questionTokens.length === 0) return [];
  const questionSet = new Set(questionTokens);

  return [...evidence]
    .map((paragraph, index) => {
      const sourceTokens = tokens(`${paragraph.document_title} ${paragraph.paragraph_text}`);
      const overlap = new Set(sourceTokens.filter((token) => questionSet.has(token))).size;
      return {
        paragraph,
        index,
        score: overlap + (paragraph.relevance ?? 0),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(1, limit))
    .map((item) => item.paragraph);
}

export function buildExtractiveKnowledgeAnswer(
  question: string,
  evidence: readonly RetrievedKnowledgeParagraph[]
) {
  const [paragraph] = rankKnowledgeEvidence(question, evidence, 1);
  if (!paragraph) {
    return {
      answer: SAFE_NO_EVIDENCE_ANSWER,
      citations: [],
      not_found: true,
    };
  }

  return {
    answer: paragraph.paragraph_text,
    citations: [
      {
        document_id: paragraph.document_id,
        document_title: paragraph.document_title,
        paragraph_n: paragraph.paragraph_n,
        excerpt: paragraph.paragraph_text,
      },
    ],
    not_found: false,
  };
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

export function verifyKnowledgeClaims(
  claims: readonly RawKnowledgeClaim[],
  evidence: readonly RetrievedKnowledgeParagraph[]
): VerifiedKnowledgeClaim[] {
  return claims.flatMap((claim) => {
    const text = typeof claim.text === "string" ? normalizeWhitespace(claim.text) : "";
    const rawCitations = Array.isArray(claim.citations)
      ? (claim.citations as RawKnowledgeCitation[])
      : [];
    const citations = verifyKnowledgeCitations(rawCitations, evidence);
    if (!text || text.length > 900 || citations.length === 0) return [];
    if (!hasDeterministicClaimSupport(text, citations)) return [];
    return [{ text, citations }];
  });
}

export function finalizeKnowledgeClaims(input: {
  claims: readonly VerifiedKnowledgeClaim[];
  notFound: unknown;
}) {
  if (input.notFound === true || input.claims.length === 0) {
    return {
      answer: SAFE_NO_EVIDENCE_ANSWER,
      citations: [] as VerifiedKnowledgeCitation[],
      claims: [] as VerifiedKnowledgeClaim[],
      not_found: true,
    };
  }

  const seen = new Set<string>();
  const citations = input.claims.flatMap((claim) =>
    claim.citations.filter((citation) => {
      const key = evidenceKey(citation.document_id, citation.paragraph_n);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  );
  return {
    answer: input.claims.map((claim) => claim.text).join("\n\n"),
    citations,
    claims: [...input.claims],
    not_found: false,
  };
}

export function selectVerifiedKnowledgeClaims(
  claims: readonly VerifiedKnowledgeClaim[],
  indexes: readonly unknown[]
) {
  const seen = new Set<number>();
  return indexes.flatMap((value) => {
    const index = Number(value);
    if (!Number.isInteger(index) || index < 0 || index >= claims.length || seen.has(index)) {
      return [];
    }
    seen.add(index);
    return [claims[index]];
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
