import {
  documentIndexStatus,
  type DocumentIndexStatus,
} from "./document-index-status.ts";

export type DocumentListRow = {
  id: string;
  title: string;
  file_type: string | null;
  storage_path: string | null;
  source_url: string | null;
  content_text: string | null;
  created_at: string;
  paragraphs: unknown;
  products: { name: string } | { name: string }[] | null;
};

export type FlattenedDocumentRow = {
  id: string;
  title: string;
  storagePath: string | null;
  sourceUrl: string | null;
  sourceType: "website" | "file" | "text";
  createdAt: string;
  productName: string | null;
  paragraphCount: number;
  indexStatus: DocumentIndexStatus;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function paragraphCount(paragraphs: unknown) {
  return Array.isArray(paragraphs) ? paragraphs.length : 0;
}

export function flattenDocumentRow(row: DocumentListRow): FlattenedDocumentRow {
  return {
    id: row.id,
    title: row.title,
    storagePath: row.storage_path,
    sourceUrl: row.source_url,
    sourceType: row.source_url ? "website" : row.storage_path ? "file" : "text",
    createdAt: row.created_at,
    productName: one(row.products)?.name ?? null,
    paragraphCount: paragraphCount(row.paragraphs),
    indexStatus: documentIndexStatus({
      contentText: row.content_text,
      paragraphs: row.paragraphs,
      storagePath: row.storage_path,
    }),
  };
}
