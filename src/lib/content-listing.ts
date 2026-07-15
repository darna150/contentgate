import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Joined<T> = T | T[] | null;

export type ContentListRow = {
  id: string;
  title: string;
  status: string;
  target_language: string;
  audience: string | null;
  created_at: string;
  updated_at?: string | null;
  products: Joined<{ name: string }>;
  templates?: Joined<{ name: string }>;
  product_templates: Joined<{ variant: string }>;
  template_versions: Joined<{
    version_label: string;
    template_families: Joined<{ name: string }>;
  }>;
  template_variants: Joined<{ label: string; variant_key: string }>;
  creator?: Joined<{ full_name: string | null }>;
};

export type FlattenedContentRow = {
  id: string;
  title: string;
  status: string;
  targetLanguage: string;
  audience: string | null;
  createdAt: string;
  updatedAt: string | null;
  productName: string | null;
  templateName: string | null;
  creatorName: string | null;
};

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

export function one<T>(value: Joined<T> | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function offsetFromCursor(cursor: string | null | undefined) {
  if (!cursor) return 0;
  const parsed = Number.parseInt(cursor, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function cursorFromOffset(offset: number) {
  return String(Math.max(0, offset));
}

export function flattenContentRow(row: ContentListRow): FlattenedContentRow {
  const templateVersion = one(row.template_versions);
  const templateFamily = one(templateVersion?.template_families);
  const templateVariant = one(row.template_variants);
  const platformTemplateLabel = [
    templateFamily?.name,
    templateVariant?.label ?? templateVariant?.variant_key,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    targetLanguage: row.target_language,
    audience: row.audience,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    productName: one(row.products)?.name ?? null,
    templateName:
      one(row.product_templates)?.variant ??
      (platformTemplateLabel || one(row.templates)?.name || null),
    creatorName: one(row.creator)?.full_name ?? null,
  };
}

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
