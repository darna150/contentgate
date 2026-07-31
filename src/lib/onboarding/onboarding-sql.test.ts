import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../../../supabase/migrations/20260730142808_one_click_onboarding_control_plane.sql", import.meta.url),
  "utf8",
);
const ambiguityFixSql = readFileSync(
  new URL("../../../supabase/migrations/20260730144321_fix_onboarding_org_id_ambiguity.sql", import.meta.url),
  "utf8",
);
const retryFixSql = readFileSync(
  new URL("../../../supabase/migrations/20260730144438_fix_onboarding_retry_run_id_ambiguity.sql", import.meta.url),
  "utf8",
);
const tenantVariableFixSql = readFileSync(
  new URL("../../../supabase/migrations/20260730144615_rename_onboarding_tenant_variables.sql", import.meta.url),
  "utf8",
);
const campaignIndexSql = readFileSync(
  new URL("../../../supabase/migrations/20260730150146_onboarding_campaign_fk_indexes.sql", import.meta.url),
  "utf8",
);
const disposableCleanupSql = readFileSync(
  new URL("../../../supabase/migrations/20260731052439_dispose_completed_staging_onboarding.sql", import.meta.url),
  "utf8",
);

test("control-plane tables are RLS protected and service-role only", () => {
  assert.match(sql, /alter table public\.onboarding_runs enable row level security/i);
  assert.match(sql, /revoke all on table public\.onboarding_runs from public, anon, authenticated/i);
  assert.match(sql, /grant all on table public\.onboarding_runs to service_role/i);
  assert.match(sql, /onboarding_package_uploads[\s\S]+expires_at timestamptz not null default \(now\(\) \+ interval '2 hours'\)/i);
  assert.doesNotMatch(sql, /create policy[^;]+on public\.onboarding_runs/i);
});

test("every mutating onboarding RPC is explicitly revoked from browser roles", () => {
  for (const signature of [
    "begin_onboarding_run\\(text, text, jsonb, uuid, text\\)",
    "record_onboarding_step\\(uuid, text, text, jsonb, text\\)",
    "apply_onboarding_blueprint\\(uuid, uuid, jsonb, jsonb\\)",
    "complete_onboarding_run\\(uuid, jsonb\\)",
    "mark_onboarding_run_failed\\(uuid, text, text\\)",
    "rollback_onboarding_run\\(uuid\\)",
    "insert_compiled_template_bundle\\(jsonb\\)",
  ]) {
    assert.match(
      sql,
      new RegExp(`revoke all on function public\\.${signature}\\s+from public, anon, authenticated`, "i"),
      signature,
    );
  }
});

test("core provisioning and template relational imports have transaction RPC boundaries", () => {
  assert.match(sql, /create or replace function public\.apply_onboarding_blueprint/i);
  assert.match(sql, /insert into public\.products/i);
  assert.match(sql, /insert into public\.campaigns/i);
  assert.match(sql, /insert into public\.documents/i);
  assert.match(sql, /insert into public\.product_claims/i);
  assert.match(sql, /insert into public\.product_assets/i);
  assert.match(sql, /create or replace function public\.insert_compiled_template_bundle/i);
});

test("Auth email lookup is constant-query and service-role only", () => {
  assert.match(sql, /create or replace function public\.find_onboarding_user_by_email/i);
  assert.match(sql, /where users\.email = lower\(trim\(p_email\)\)/i);
  assert.match(
    sql,
    /revoke all on function public\.find_onboarding_user_by_email\(text\)\s+from public, anon, authenticated/i,
  );
  assert.match(
    sql,
    /grant execute on function public\.find_onboarding_user_by_email\(text\)\s+to service_role/i,
  );
});

test("concurrent user provisioning is bound to a run-scoped capability token", () => {
  assert.match(sql, /create table if not exists private\.onboarding_user_provisioning/i);
  assert.match(sql, /unique \(run_id, email\)/i);
  assert.match(sql, /create or replace function public\.stage_onboarding_user/i);
  assert.match(sql, /where token = onboarding_token[\s\S]+email = lower\(trim\(new\.email\)\)/i);
  assert.match(
    sql,
    /revoke all on function public\.stage_onboarding_user\(uuid, text, uuid, public\.user_role, text\)\s+from public, anon, authenticated/i,
  );
});

test("failure recovery preserves completed runs and waits for Auth profile deletion", () => {
  assert.match(sql, /Completed onboarding runs cannot be rolled back automatically/i);
  assert.match(sql, /if exists \(select 1 from public\.profiles where profiles\.org_id = org_id\)/i);
  assert.match(sql, /current_step = 'delete_users'/i);
  assert.match(sql, /delete from public\.organizations where organizations\.id = org_id/i);
});

test("provisioning and compensation resolve the tenant variable deterministically", () => {
  assert.match(ambiguityFixSql, /apply_onboarding_blueprint\(uuid,uuid,jsonb,jsonb\)/i);
  assert.match(ambiguityFixSql, /rollback_onboarding_run\(uuid\)/i);
  assert.match(ambiguityFixSql, /#variable_conflict use_variable/i);
});

test("retry resolution prefers the audited step table run identifier", () => {
  assert.match(retryFixSql, /begin_onboarding_run\(text,text,jsonb,uuid,text\)/i);
  assert.match(retryFixSql, /#variable_conflict use_column/i);
});

test("tenant RPC locals cannot shadow ON CONFLICT tenant columns", () => {
  assert.match(tenantVariableFixSql, /target_org_id/i);
  assert.match(tenantVariableFixSql, /values \(\\n      org_id,/i);
  assert.match(tenantVariableFixSql, /Could not safely rewrite apply_onboarding_blueprint/i);
  assert.match(tenantVariableFixSql, /Could not safely rewrite rollback_onboarding_run/i);
});

test("campaign tenant foreign keys have covering indexes", () => {
  assert.match(campaignIndexSql, /campaigns \(org_id, product_id\)/i);
  assert.match(campaignIndexSql, /generated_content \(org_id, campaign_id\)/i);
});

test("operator package storage has no browser policy and bounded ZIP inputs", () => {
  assert.match(sql, /'onboarding-packages'[\s\S]+52428800/i);
  assert.match(sql, /array\['application\/zip', 'application\/x-zip-compressed'\]/i);
  assert.doesNotMatch(sql, /create policy[^;]+onboarding-packages/i);
});

test("completed-run disposal is staging-only, explicitly confirmed, and service-role only", () => {
  assert.match(disposableCleanupSql, /environment <> 'staging'/i);
  assert.match(disposableCleanupSql, /workspace_key !~ '\^qa-onboarding-'/i);
  assert.match(disposableCleanupSql, /'DELETE STAGING ' \|\| target_run\.workspace_key/i);
  assert.match(disposableCleanupSql, /Delete disposable Auth users before finalizing cleanup/i);
  assert.match(
    disposableCleanupSql,
    /revoke all on function public\.dispose_completed_onboarding_run\(uuid, text, boolean\)[\s\S]+from public, anon, authenticated/i,
  );
  assert.match(
    disposableCleanupSql,
    /grant execute on function public\.dispose_completed_onboarding_run\(uuid, text, boolean\)[\s\S]+to service_role/i,
  );
});
