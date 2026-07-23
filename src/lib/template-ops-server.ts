import "server-only";

import { offsetFromCursor } from "@/lib/content-listing-shared";
import { createClient } from "@/lib/supabase/server";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import {
  mapTemplateExportHistoryRow,
  templateOpsPageResult,
  type TemplateExportHistoryItem,
  type TemplateExportHistoryRow,
  type TemplateOpsPageResult,
} from "@/lib/template-ops-shared";
export {
  mapTemplateExportHistoryRow,
  templateOpsPageResult,
  type TemplateExportHistoryItem,
  type TemplateExportHistoryRow,
  type TemplateOpsPageResult,
} from "@/lib/template-ops-shared";

export type TemplateVersionListRow = {
  id: string;
  version_label: string;
  status: string;
  created_at: string;
  manifest: TemplateBundleManifest | null;
  template_families:
    | { name: string; family_key: string }
    | { name: string; family_key: string }[]
    | null;
};

export type ProductTemplateAssignmentListRow = {
  id: string;
  status: string;
  default_variant_key: string | null;
  products: { name: string } | { name: string }[] | null;
  template_families: { name: string } | { name: string }[] | null;
  template_versions: { version_label: string } | { version_label: string }[] | null;
};

export type TemplateImportRunListRow = {
  id: string;
  source_provider: string;
  status: string;
  manifest_sha256: string | null;
  report: { issues?: unknown[] } | null;
  created_at: string;
};

function pageWindow(cursor: string | null | undefined, pageSize: number | undefined) {
  const offset = offsetFromCursor(cursor);
  const safePageSize = Math.min(Math.max(pageSize ?? 20, 1), 100);
  return {
    offset,
    safePageSize,
    from: offset,
    to: offset + safePageSize,
  };
}

export async function getTemplateExportHistory({
  templateVersionId,
  templateVariantId,
  cursor,
  limit = 20,
}: {
  templateVersionId?: string | null;
  templateVariantId?: string | null;
  cursor?: string | null;
  limit?: number;
} = {}): Promise<TemplateOpsPageResult<TemplateExportHistoryItem>> {
  const { offset, safePageSize, from, to } = pageWindow(cursor, limit);
  const supabase = await createClient();
  let query = supabase
    .from("render_jobs")
    .select(
      "id, status, output_format, output_storage_path, created_at, completed_at, template_version_id, template_variant_id, generated_content!render_jobs_generated_content_id_fkey(title, created_by, creator:profiles!generated_content_created_by_fkey(full_name)), template_variants(variant_key, label)"
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (templateVersionId) query = query.eq("template_version_id", templateVersionId);
  if (templateVariantId) query = query.eq("template_variant_id", templateVariantId);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load template export history: ${error.message}`);

  return templateOpsPageResult(
    ((data ?? []) as TemplateExportHistoryRow[]).map(mapTemplateExportHistoryRow),
    offset,
    safePageSize
  );
}

export async function getTemplateVersionsPage({
  cursor,
  pageSize = 20,
}: {
  cursor?: string | null;
  pageSize?: number;
} = {}): Promise<TemplateOpsPageResult<TemplateVersionListRow>> {
  const { offset, safePageSize, from, to } = pageWindow(cursor, pageSize);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("template_versions")
    .select("id, version_label, status, created_at, manifest, template_families(name, family_key)")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`Could not load template versions: ${error.message}`);
  return templateOpsPageResult((data ?? []) as TemplateVersionListRow[], offset, safePageSize);
}

export async function getProductTemplateAssignmentsPage({
  cursor,
  pageSize = 20,
}: {
  cursor?: string | null;
  pageSize?: number;
} = {}): Promise<TemplateOpsPageResult<ProductTemplateAssignmentListRow>> {
  const { offset, safePageSize, from, to } = pageWindow(cursor, pageSize);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_template_assignments")
    .select("id, status, default_variant_key, products(name), template_families!product_template_assignments_template_family_id_fkey(name), template_versions!product_template_assignments_template_version_id_fkey(version_label)")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`Could not load product template assignments: ${error.message}`);
  return templateOpsPageResult((data ?? []) as ProductTemplateAssignmentListRow[], offset, safePageSize);
}

export async function getTemplateImportRunsPage({
  cursor,
  pageSize = 20,
}: {
  cursor?: string | null;
  pageSize?: number;
} = {}): Promise<TemplateOpsPageResult<TemplateImportRunListRow>> {
  const { offset, safePageSize, from, to } = pageWindow(cursor, pageSize);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("template_import_runs")
    .select("id, source_provider, status, manifest_sha256, report, created_at")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`Could not load template import runs: ${error.message}`);
  return templateOpsPageResult((data ?? []) as TemplateImportRunListRow[], offset, safePageSize);
}
