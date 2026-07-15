import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  mapTemplateExportHistoryRow,
  type TemplateExportHistoryItem,
  type TemplateExportHistoryRow,
} from "@/lib/template-ops-shared";
export {
  mapTemplateExportHistoryRow,
  type TemplateExportHistoryItem,
  type TemplateExportHistoryRow,
} from "@/lib/template-ops-shared";

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

  return ((data ?? []) as TemplateExportHistoryRow[]).map(mapTemplateExportHistoryRow);
}
