import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260720123000_phase1a_tenant_integrity.sql",
  "utf8"
);

function compact(sql: string) {
  return sql.replace(/\s+/g, " ").toLowerCase();
}

const sql = compact(migration);

test("Phase 1A migration adds composite tenant foreign keys", () => {
  for (const constraint of [
    "documents_org_uploaded_by_fkey",
    "documents_org_product_fkey",
    "product_claims_org_product_fkey",
    "product_assets_org_product_fkey",
    "product_templates_org_product_fkey",
    "generated_content_org_created_by_fkey",
    "generated_content_org_approved_by_fkey",
    "generated_content_org_product_fkey",
    "generated_content_org_product_template_fkey",
    "generated_content_org_template_version_fkey",
    "generated_content_org_template_variant_fkey",
    "audit_log_org_actor_fkey",
    "knowledge_queries_org_product_fkey",
    "knowledge_queries_org_user_fkey",
    "notebook_sessions_org_user_fkey",
    "notebook_sessions_org_product_fkey",
    "generated_content_revisions_org_content_fkey",
    "generated_content_revisions_org_actor_fkey",
    "generated_content_events_org_content_fkey",
    "generated_content_events_org_actor_fkey",
    "template_versions_org_family_fkey",
    "template_versions_org_created_by_fkey",
    "template_variants_org_version_fkey",
    "template_assets_org_version_fkey",
    "template_assets_org_variant_fkey",
    "product_template_assignments_org_product_fkey",
    "product_template_assignments_org_family_fkey",
    "product_template_assignments_org_version_fkey",
    "template_import_runs_org_version_fkey",
    "template_import_runs_org_created_by_fkey",
    "render_jobs_org_product_fkey",
    "render_jobs_org_content_fkey",
    "render_jobs_org_template_version_fkey",
    "render_jobs_org_template_variant_fkey",
  ]) {
    assert.match(sql, new RegExp(`constraint ${constraint}`));
  }

  assert.match(sql, /foreign key \(org_id, product_id\) references public\.products \(org_id, id\)/);
  assert.match(sql, /foreign key \(org_id, template_version_id\) references public\.template_versions \(org_id, id\)/);
});

test("Phase 1A migration hardens core statuses", () => {
  assert.match(sql, /constraint products_status_valid/);
  assert.match(sql, /check \(status in \('active', 'archived'\)\)/);
  assert.match(sql, /constraint product_claims_status_valid/);
  assert.match(sql, /check \(status in \('approved', 'inactive'\)\)/);
  assert.match(sql, /constraint product_templates_status_valid/);
  assert.match(sql, /check \(status in \('active', 'inactive'\)\)/);
});

test("Phase 1A migration keeps storage paths org-prefixed", () => {
  for (const bucket of ["documents", "product-assets", "rendered-assets", "template-bundles"]) {
    assert.match(sql, new RegExp(`bucket_id = '${bucket}'`));
  }

  assert.match(sql, /\(storage\.foldername\(name\)\)\[1\] = \(select public\.auth_org_id\(\)\)::text/);
  assert.match(sql, /create policy "admin document files update"/);
  assert.match(sql, /create policy "admin product asset files update"/);
  assert.match(sql, /create policy "admin rendered assets delete"/);
  assert.match(sql, /create policy "admin template bundle assets delete"/);
});

test("Phase 1A migration adds explicit Data API grants", () => {
  for (const table of [
    "organizations",
    "profiles",
    "documents",
    "generated_content",
    "products",
    "product_claims",
    "product_assets",
    "product_templates",
    "template_versions",
    "template_variants",
    "product_template_assignments",
    "render_jobs",
  ]) {
    assert.match(sql, new RegExp(`grant select on table public\\.${table} to authenticated`));
  }

  assert.match(sql, /grant usage on schema public to anon, authenticated/);
  assert.match(sql, /grant execute on function public\.transition_generated_content\(uuid, text, text\) to authenticated/);
  assert.match(sql, /grant execute on function public\.record_render_job_event\(uuid, text, text, jsonb, jsonb\) to authenticated/);
});

test("asset download recording is an atomic authorized RPC", () => {
  const sql = readFileSync(
    "supabase/migrations/20260724122156_record_product_asset_download.sql",
    "utf8"
  );

  assert.match(sql, /create or replace function public\.record_product_asset_download\(p_asset_id uuid\)/);
  assert.match(sql, /security definer/);
  assert.match(sql, /caller_id uuid := auth\.uid\(\)/);
  assert.match(sql, /asset_status <> 'approved' and caller_role <> 'admin'/);
  assert.match(sql, /download_count = coalesce\(download_count, 0\) \+ 1/);
  assert.match(sql, /revoke all on function public\.record_product_asset_download\(uuid\) from public/);
  assert.match(sql, /revoke all on function public\.record_product_asset_download\(uuid\) from anon/);
  assert.match(sql, /grant execute on function public\.record_product_asset_download\(uuid\) to authenticated/);
});
