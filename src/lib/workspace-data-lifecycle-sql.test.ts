import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260731140658_workspace_data_lifecycle.sql", import.meta.url),
  "utf8",
);
const cleanupScript = readFileSync(
  new URL("../../scripts/cleanup-disposable-onboarding.ts", import.meta.url),
  "utf8",
);

test("workspace lifecycle evidence is global, RLS protected, and service-only", () => {
  for (const table of ["workspace_data_export_receipts", "workspace_deletion_receipts"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(
      sql,
      new RegExp(`revoke all on table public\\.${table}[\\s\\S]+from public, anon, authenticated`, "i"),
    );
    assert.match(sql, new RegExp(`grant all on table public\\.${table} to service_role`, "i"));
  }
  assert.doesNotMatch(sql, /workspace_deletion_receipts[\s\S]{0,500}references public\.organizations/i);
  assert.match(sql, /grant select on table[\s\S]+public\.generated_content_events[\s\S]+to service_role/i);
});

test("deletion requires a matching export, dual approval, exact confirmation, and no legal hold", () => {
  assert.match(sql, /requester and approver must be different people/i);
  assert.match(sql, /a matching completed workspace export receipt is required/i);
  assert.match(sql, /workspace is under legal hold/i);
  assert.match(sql, /'DELETE ' \|\| upper\(p_environment\) \|\| ' ' \|\| p_workspace_key/i);
  assert.match(sql, /production deletion requires a change identifier/i);
});

test("database deletion pauses for supported Storage and Auth API cleanup", () => {
  assert.match(sql, /status = 'awaiting_auth_cleanup'/i);
  assert.match(sql, /delete workspace Auth users before finalizing/i);
  assert.match(sql, /delete from public\.organizations/i);
  assert.match(sql, /from storage\.objects/i);
  assert.doesNotMatch(sql, /delete from storage\.objects/i);
});

test("every lifecycle RPC is explicitly unavailable to browser roles", () => {
  for (const signature of [
    "list_workspace_storage_objects\\(uuid\\)",
    "record_workspace_data_export\\(\\s*uuid, text, text, text, text, text, text, bigint, integer\\s*\\)",
    "set_workspace_legal_hold\\(uuid, text, boolean, text\\)",
    "begin_workspace_deletion\\(\\s*uuid, text, text, text, text, text, text, integer, text, text\\s*\\)",
    "prepare_workspace_deletion\\(uuid\\)",
    "finalize_workspace_deletion\\(uuid\\)",
    "record_workspace_deletion_failure\\(uuid, text\\)",
  ]) {
    assert.match(
      sql,
      new RegExp(`revoke all on function public\\.${signature}[\\s\\S]+?from public, anon, authenticated`, "i"),
      signature,
    );
  }
});

test("legacy disposable cleanup removes render outputs from rendered-assets", () => {
  assert.match(
    cleanupScript,
    /\["rendered-assets", pathsFromRows\(storageQueries\[3\]\.data, \["output_storage_path"\]\)\]/,
  );
});
