import "server-only";

import { createClient } from "@/lib/supabase/server";
export {
  cursorFromOffset,
  flattenContentRow,
  offsetFromCursor,
  one,
  type ContentListRow,
  type ContentPageInput,
  type FlattenedContentRow,
  type Joined,
} from "@/lib/content-listing-shared";
import {
  cursorFromOffset,
  flattenContentRow,
  offsetFromCursor,
  type ContentListRow,
  type ContentPageInput,
  type FlattenedContentRow,
} from "@/lib/content-listing-shared";

export type ContentPageResult = {
  rows: FlattenedContentRow[];
  nextCursor: string | null;
  hasMore: boolean;
};

export const CONTENT_LIST_SELECT =
  "id, title, status, target_language, audience, created_at, updated_at, products!generated_content_product_id_fkey(name), templates(name), product_templates!generated_content_product_template_id_fkey(variant), template_versions!generated_content_template_version_id_fkey(version_label, template_families!template_versions_family_id_fkey(name)), template_variants!generated_content_template_variant_id_fkey(label, variant_key), creator:profiles!generated_content_created_by_fkey(full_name)";
const CONTENT_LIST_SELECT_WITH_REQUIRED_VARIANT =
  "id, title, status, target_language, audience, created_at, updated_at, products!generated_content_product_id_fkey(name), templates(name), product_templates!generated_content_product_template_id_fkey(variant), template_versions!generated_content_template_version_id_fkey(version_label, template_families!template_versions_family_id_fkey(name)), template_variants!generated_content_template_variant_id_fkey!inner(label, variant_key), creator:profiles!generated_content_created_by_fkey(full_name)";

export async function getContentPage({
  cursor,
  pageSize = 50,
  productId,
  status,
  targetLanguage,
  variantKey,
  ascending = false,
}: ContentPageInput = {}): Promise<ContentPageResult> {
  const offset = offsetFromCursor(cursor);
  const safePageSize = Math.min(Math.max(pageSize, 1), 100);
  const supabase = await createClient();
  let query = supabase
    .from("generated_content")
    .select(variantKey ? CONTENT_LIST_SELECT_WITH_REQUIRED_VARIANT : CONTENT_LIST_SELECT)
    .not("product_id", "is", null)
    .order("created_at", { ascending })
    .range(offset, offset + safePageSize);

  if (productId) query = query.eq("product_id", productId);
  if (status) query = query.eq("status", status);
  if (targetLanguage) query = query.eq("target_language", targetLanguage);
  if (variantKey) query = query.eq("template_variants.variant_key", variantKey);

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
