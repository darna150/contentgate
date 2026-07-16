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
  sizeKey: string | null;
  creatorName: string | null;
};

export type ContentPageInput = {
  cursor?: string | null;
  pageSize?: number;
  productId?: string | null;
  status?: string | null;
  targetLanguage?: string | null;
  variantKey?: string | null;
  ascending?: boolean;
};

export function one<T>(value: Joined<T> | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function offsetFromCursor(cursor: string | null | undefined) {
  if (!cursor) return 0;
  const parsed = Number.parseInt(cursor, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function cursorFromOffset(offset: number) {
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
    sizeKey: templateVariant?.variant_key ?? null,
    creatorName: one(row.creator)?.full_name ?? null,
  };
}
