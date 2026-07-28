import {
  normalizeRetrievedParagraphs,
  type RetrievedKnowledgeParagraph,
} from "./knowledge-reliability.ts";

const QUESTION_START = /^(?:what|who|how|when|where|which|does|do|did|is|are|can|should|will)\b/i;

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function evidenceKey(paragraph: RetrievedKnowledgeParagraph) {
  return `${paragraph.document_id}:${paragraph.paragraph_n}`;
}

export function buildAskRetrievalQueries(question: string, limit = 3) {
  const normalized = normalize(question).slice(0, 700);
  if (!normalized) return [];

  const candidates = [normalized];
  const clauses = normalized
    .split(/\s+(?:and|then|also|as well as)\s+(?=(?:what|who|how|when|where|which|does|do|did|is|are|can|should|will)\b)/i)
    .map(normalize)
    .filter((clause) => clause.length >= 8 && QUESTION_START.test(clause));
  candidates.push(...clauses);

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.toLocaleLowerCase();
    if (seen.has(key) || !candidate) return false;
    seen.add(key);
    return true;
  }).slice(0, Math.min(Math.max(limit, 1), 3));
}

export function fuseAskRetrievalEvidence(
  groups: readonly (readonly Partial<RetrievedKnowledgeParagraph>[])[],
  limit = 18
) {
  const byKey = new Map<string, RetrievedKnowledgeParagraph>();
  for (const group of groups) {
    for (const paragraph of normalizeRetrievedParagraphs(group)) {
      const key = evidenceKey(paragraph);
      const existing = byKey.get(key);
      if (!existing || (paragraph.relevance ?? 0) > (existing.relevance ?? 0)) {
        byKey.set(key, paragraph);
      }
    }
  }

  const ranked = [...byKey.values()].sort(
    (left, right) =>
      (right.relevance ?? 0) - (left.relevance ?? 0) ||
      left.document_id.localeCompare(right.document_id) ||
      left.paragraph_n - right.paragraph_n
  );
  const diversified: RetrievedKnowledgeParagraph[] = [];
  const perDocument = new Map<string, number>();
  const maxPerDocument = 3;

  for (const paragraph of ranked) {
    const count = perDocument.get(paragraph.document_id) ?? 0;
    if (count >= maxPerDocument) continue;
    perDocument.set(paragraph.document_id, count + 1);
    diversified.push(paragraph);
    if (diversified.length >= Math.min(Math.max(limit, 1), 30)) break;
  }
  return diversified;
}
