import { one, type Joined } from "./content-listing-shared.ts";

export type TemplateExportHistoryRow = {
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

export function mapTemplateExportHistoryRow(
  job: TemplateExportHistoryRow
): TemplateExportHistoryItem {
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
}
