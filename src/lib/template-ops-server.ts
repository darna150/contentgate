import "server-only";

import { createClient } from "@/lib/supabase/server";
import { one, type Joined } from "@/lib/content-listing";

type RenderJobRow = {
  id: string;
  status: string;
  output_format: string;
  output_storage_path: string | null;
  created_at: string;
  completed_at: string | null;
  template_version_id: string;
  template_variant_id: string;
  generated_content: Joined<{
    title: string;
    created_by: string;
    creator: Joined<{ full_name: string | null }>;
  }>;
  template_variants: Joined<{ variant_key: string; label: string }>;
};

export type TemplateExportHistoryItem = {
  id: string;
  status: string;
  outputFormat: string;
  outputStoragePath: string | null;
  createdAt: string;
  completedAt: string | null;
  templateVersionId: string;
  templateVariantId: string;
  variantKey: string | null;
  variantLabel: string | null;
  contentTitle: string | null;
  exportedById: string | null;
  exportedByName: string | null;
};

export async function getTemplateExportHistory({
  templateVersionId,
  templateVariantId,
  limit = 20,
}: {
  templateVersionId?: string | null;
  templateVariantId?: string | null;
  limit?: number;
} = {}): Promise<TemplateExportHistoryItem[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const supabase = await createClient();
  let query = supabase
    .from("render_jobs")
    .select(
      "id, status, output_format, output_storage_path, created_at, completed_at, template_version_id, template_variant_id, generated_content(title, created_by, creator:profiles!generated_content_created_by_fkey(full_name)), template_variants(variant_key, label)"
    )
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (templateVersionId) query = query.eq("template_version_id", templateVersionId);
  if (templateVariantId) query = query.eq("template_variant_id", templateVariantId);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load template export history: ${error.message}`);

  return ((data ?? []) as RenderJobRow[]).map((job) => {
    const content = one(job.generated_content);
    const creator = one(content?.creator);
    const variant = one(job.template_variants);

    return {
      id: job.id,
      status: job.status,
      outputFormat: job.output_format,
      outputStoragePath: job.output_storage_path,
      createdAt: job.created_at,
      completedAt: job.completed_at,
      templateVersionId: job.template_version_id,
      templateVariantId: job.template_variant_id,
      variantKey: variant?.variant_key ?? null,
      variantLabel: variant?.label ?? null,
      contentTitle: content?.title ?? null,
      exportedById: content?.created_by ?? null,
      exportedByName: creator?.full_name ?? null,
    };
  });
}
