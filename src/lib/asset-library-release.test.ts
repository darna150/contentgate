import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { productAssetMediaKindForMimeType, validateProductAssetFile } from "./product-assets.ts";

const phase0 = readFileSync("supabase/migrations/20260728061333_phase0_asset_library_hardening.sql", "utf8");
const phase1 = readFileSync("supabase/migrations/20260728062642_phase1_asset_media_jobs.sql", "utf8");
const phase2 = readFileSync("supabase/migrations/20260728064525_phase2_asset_versioning_lifecycle.sql", "utf8");
const phase3 = readFileSync("supabase/migrations/20260728080432_phase3_asset_media_observability.sql", "utf8");

test("release SQL keeps member discovery and storage reads approval-gated", () => {
  assert.match(phase0, /approval_status = 'approved' and archived_at is null/);
  assert.match(phase0, /role-aware product asset files read/);
  assert.match(phase0, /storage\.foldername\(name\)\)\[1\] = \(select public\.auth_org_id\(\)\)::text/);
});

test("release SQL requires immutable versions and recoverable archive retention", () => {
  assert.match(phase2, /create table if not exists public\.product_asset_versions/);
  assert.match(phase2, /current_version_id uuid/);
  assert.match(phase2, /purge_after timestamptz/);
  assert.match(phase2, /owner processing product asset files delete/);
  assert.match(phase2, /drop policy if exists "admin product asset files update"/);
});

test("release SQL includes durable worker claiming and a liveness signal", () => {
  assert.match(phase1, /for update skip locked/);
  assert.match(phase1, /attempt_count = attempt_count \+ 1/);
  assert.match(phase3, /asset_media_worker_heartbeats/);
});

test("synthetic brand-file fixtures are accepted or rejected by exact MIME policy", () => {
  assert.equal(productAssetMediaKindForMimeType("application/pdf"), "document");
  assert.equal(productAssetMediaKindForMimeType("application/zip"), null);
  assert.doesNotThrow(() =>
    validateProductAssetFile({ size: 1024, type: "application/pdf" })
  );
  assert.throws(
    () => validateProductAssetFile({ size: 1024, type: "application/zip" }),
    /Use a PNG/
  );
});
