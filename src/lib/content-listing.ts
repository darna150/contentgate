import "server-only";

import { createClient } from "@/lib/supabase/server";
export {
  cursorFromOffset,
  flattenContentRow,
  offsetFromCursor,
  one,
  type ContentListRow,
  type FlattenedContentRow,
  type Joined,
} from "@/lib/content-listing-shared";
import {
  cursorFromOffset,
  flattenContentRow,
  offsetFromCursor,
  type ContentListRow,
  type FlattenedContentRow,
} from "@/lib/content-listing-shared";

export type ContentPageResult = {
  rows: FlattenedContentRow[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type ContentPageInput = {
  cursor?: string | null;
  pageSize?: number;
  productId?: string | null;
  status?: string | null;
  ascending?: boolean;
};

export const CONTENT_LIST_SELECT =
  "id, title, status, target_language, audience, created_at, updated_at, products(name), templates(name), product_templates(variant), template_versions(version_label, template_families(name)), template_variants(label, variant_key), creator:profiles!generated_content_created_by_fkey(full_name)";

export async function getContentPage({
  cursor,
  pageSize = 50,
  productId,
  status,
  ascending = false,
}: ContentPageInput = {}): Promise<ContentPageResult> {
  const offset = offsetFromCursor(cursor);
  const safePageSize = Math.min(Math.max(pageSize, 1), 100);
  const supabase = await createClient();
  let query = supabase
    .from("generated_content")
    .select(CONTENT_LIST_SELECT)
    .not("product_id", "is", null)
    .order("created_at", { ascending })
    .range(offset, offset + safePageSize);

  if (productId) query = query.eq("product_id", productId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load content page: ${error.message}`);

  const fetchedRows = (data ?? []) as ContentListRow[];
  const visibleRows = fetchedRows.slice(0, safePageSize);
  const hasMore = fetchedRows.length > safePageSize;

  return {
    rows: visibleRows.map(flattenContentRow),
    hasMore,
    nextCursor: hasMore ? cursorFromOffset(offset + safePageSize) : null,
  };
}

export async function getApprovalPage(
  input: Omit<ContentPageInput, "status" | "ascending"> = {}
): Promise<ContentPageResult> {
  return getContentPage({
    ...input,
    status: "in_review",
    ascending: true,
  });
}
