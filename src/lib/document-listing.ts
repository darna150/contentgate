import "server-only";

import { cursorFromOffset, offsetFromCursor } from "@/lib/content-listing-shared";
import {
  flattenDocumentRow,
  type DocumentListRow,
  type FlattenedDocumentRow,
} from "@/lib/document-listing-shared";
import { createClient } from "@/lib/supabase/server";

export type DocumentPageInput = {
  cursor?: string | null;
  pageSize?: number;
  productId?: string | null;
};

export type DocumentPageResult = {
  rows: FlattenedDocumentRow[];
  nextCursor: string | null;
  hasMore: boolean;
};

export const DOCUMENT_LIST_SELECT =
  "id, title, storage_path, content_text, created_at, paragraphs, products!documents_product_id_fkey(name)";

export async function getDocumentPage({
  cursor,
  pageSize = 50,
  productId,
}: DocumentPageInput = {}): Promise<DocumentPageResult> {
  const offset = offsetFromCursor(cursor);
  const safePageSize = Math.min(Math.max(pageSize, 1), 100);
  const supabase = await createClient();
  let query = supabase
    .from("documents")
    .select(DOCUMENT_LIST_SELECT)
    .order("created_at", { ascending: false })
    .range(offset, offset + safePageSize);

  if (productId) query = query.eq("product_id", productId);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load document page: ${error.message}`);

  const fetchedRows = (data ?? []) as DocumentListRow[];
  const visibleRows = fetchedRows.slice(0, safePageSize);
  const hasMore = fetchedRows.length > safePageSize;

  return {
    rows: visibleRows.map(flattenDocumentRow),
    hasMore,
    nextCursor: hasMore ? cursorFromOffset(offset + safePageSize) : null,
  };
}
