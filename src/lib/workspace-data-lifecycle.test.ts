import assert from "node:assert/strict";
import test from "node:test";

import {
  checkWorkspaceDataOperation,
  parseWorkspaceExportManifest,
  safeArchiveEntryPath,
  workspaceDataConfirmation,
} from "./workspace-data-lifecycle.ts";

test("workspace data operations require exact environment binding and confirmation", () => {
  assert.equal(
    workspaceDataConfirmation("DELETE", "staging", "qa-lifecycle-one"),
    "DELETE STAGING qa-lifecycle-one",
  );
  const check = checkWorkspaceDataOperation({
    action: "EXPORT",
    environment: "staging",
    supabaseUrl: "https://stagingref.supabase.co",
    expectedProjectRef: "stagingref",
    workspaceKey: "qa-lifecycle-one",
    confirmation: "EXPORT STAGING qa-lifecycle-one",
    allowProduction: undefined,
  });
  assert.equal(check.ok, true);
});

test("production deletion requires both enablement and a change identifier", () => {
  const check = checkWorkspaceDataOperation({
    action: "DELETE",
    environment: "production",
    supabaseUrl: "https://prodref.supabase.co",
    expectedProjectRef: "prodref",
    workspaceKey: "customer-one",
    confirmation: "DELETE PRODUCTION customer-one",
    allowProduction: undefined,
  });
  assert.equal(check.ok, false);
  assert.match(check.errors.join("\n"), /disabled/i);
  assert.match(check.errors.join("\n"), /change identifier/i);
});

test("archive paths reject traversal and backslashes", () => {
  assert.equal(safeArchiveEntryPath("storage", "documents", "org/file.pdf"), "storage/documents/org/file.pdf");
  assert.throws(() => safeArchiveEntryPath("storage", "../secret"), /Unsafe/);
  assert.throws(() => safeArchiveEntryPath("storage", "folder\\secret"), /Unsafe/);
});

test("export manifests are structurally checked", () => {
  const manifest = parseWorkspaceExportManifest({
    schemaVersion: 1,
    generatedAt: "2026-07-31T00:00:00.000Z",
    environment: "staging",
    organizationId: "org-id",
    workspaceKey: "qa-lifecycle-one",
    migrationHead: "20260731140658",
    tableRows: { products: 1 },
    entries: [{ path: "database/products.json", sha256: "a".repeat(64), bytes: 2 }],
    limitations: [],
  });
  assert.equal(manifest.workspaceKey, "qa-lifecycle-one");
});
