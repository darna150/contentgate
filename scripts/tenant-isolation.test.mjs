// Cross-tenant isolation test. This test never gets deleted.
//
// Runs against a local Supabase stack (`supabase start`) with the full
// migration history replayed. It creates two organizations with one admin
// user each, then proves that no query, write, or storage access from one
// org can ever touch the other org's data.
//
// Required env (from `supabase status -o env`):
//   API_URL, ANON_KEY, SERVICE_ROLE_KEY, DB_URL
//
// Run: node --test scripts/tenant-isolation.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const API_URL = process.env.API_URL;
const ANON_KEY = process.env.ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
const DB_URL = process.env.DB_URL;

// Tables that intentionally have no org_id column. Adding a table here is a
// deliberate decision that it holds no tenant data — anything new that is
// missing from both this list and an org_id column fails the test.
const GLOBAL_TABLES = new Set(["organizations"]);

// 1x1 transparent PNG so image-restricted buckets accept the marker object.
const MARKER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

function psql(query) {
  return execFileSync("psql", [DB_URL, "-At", "-F", "\t", "-c", query], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
}

function serviceClient() {
  return createClient(API_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createOrgWithAdmin(admin, label) {
  const orgId = randomUUID();
  const email = `isolation-${label}-${orgId.slice(0, 8)}@example.com`;
  const password = `Isolation-${randomUUID()}`;

  const { error: orgError } = await admin
    .from("organizations")
    .insert({ id: orgId, name: `Isolation Org ${label}`, industry: "Testing" });
  assert.ifError(orgError);

  const { error: provisionError } = await admin.rpc("provision_user", {
    provision_email: email,
    provision_org_id: orgId,
    provision_role: "admin",
    provision_full_name: `Isolation Admin ${label}`,
  });
  assert.ifError(provisionError);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(createError);

  const client = createClient(API_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  assert.ifError(signInError);

  return { orgId, userId: created.user.id, email, client };
}

async function seedOrgData(admin, org, label) {
  const { data: product, error: productError } = await admin
    .from("products")
    .insert({
      org_id: org.orgId,
      name: `Isolation Product ${label}`,
      description: `Seeded product for tenant-isolation checks (${label}).`,
      status: "active",
    })
    .select("id")
    .single();
  assert.ifError(productError);

  const { error: claimError } = await admin.from("product_claims").insert({
    org_id: org.orgId,
    product_id: product.id,
    claim_text: `Isolation claim ${label}`,
    status: "approved",
  });
  assert.ifError(claimError);

  const { error: auditError } = await admin.from("audit_log").insert({
    org_id: org.orgId,
    actor_id: org.userId,
    action: "isolation_test_seed",
    entity_type: "product",
    entity_id: product.id,
  });
  assert.ifError(auditError);

  return { productId: product.id };
}

test("tenant isolation", async (t) => {
  for (const [name, value] of Object.entries({
    API_URL,
    ANON_KEY,
    SERVICE_ROLE_KEY,
    DB_URL,
  })) {
    assert.ok(value, `${name} must be set (run: eval "$(supabase status -o env)")`);
  }

  const admin = serviceClient();

  await t.test("every public table has row level security enabled", () => {
    const unprotected = psql(
      "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace " +
        "where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity"
    );
    assert.deepEqual(unprotected, [], `Tables without RLS: ${unprotected.join(", ")}`);
  });

  const allTables = psql(
    "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace " +
      "where n.nspname = 'public' and c.relkind = 'r' order by c.relname"
  );
  const orgScopedTables = psql(
    "select table_name from information_schema.columns " +
      "where table_schema = 'public' and column_name = 'org_id' order by table_name"
  );

  await t.test("every public table is org-scoped or explicitly global", () => {
    const orgScoped = new Set(orgScopedTables);
    const unaccounted = allTables.filter(
      (table) => !orgScoped.has(table) && !GLOBAL_TABLES.has(table)
    );
    assert.deepEqual(
      unaccounted,
      [],
      `Tables with no org_id and no explicit global-table entry: ${unaccounted.join(", ")}`
    );
    assert.ok(
      orgScopedTables.length >= 10,
      `Expected at least 10 org-scoped tables, found ${orgScopedTables.length} — enumeration looks broken`
    );
  });

  const orgA = await createOrgWithAdmin(admin, "a");
  const orgB = await createOrgWithAdmin(admin, "b");
  const seededA = await seedOrgData(admin, orgA, "a");
  const seededB = await seedOrgData(admin, orgB, "b");

  await t.test("controls: each admin sees their own org's data", async () => {
    const { data: ownProducts, error } = await orgA.client
      .from("products")
      .select("id, org_id");
    assert.ifError(error);
    assert.ok(
      ownProducts.some((row) => row.id === seededA.productId),
      "Org A admin cannot see their own seeded product — test setup is broken"
    );
  });

  for (const [reader, other] of [
    [orgA, orgB],
    [orgB, orgA],
  ]) {
    await t.test(`reads from org ${reader.orgId} return zero org ${other.orgId} rows`, async () => {
      for (const table of orgScopedTables) {
        const { data, error } = await reader.client
          .from(table)
          .select("org_id")
          .limit(1000);
        if (error) continue; // outright denial is isolation too
        const crossRows = (data ?? []).filter((row) => row.org_id === other.orgId);
        assert.equal(
          crossRows.length,
          0,
          `${table}: visible rows belonging to the other org`
        );
      }

      const { data: orgs, error: orgError } = await reader.client
        .from("organizations")
        .select("id");
      assert.ifError(orgError);
      assert.ok(
        (orgs ?? []).every((row) => row.id !== other.orgId),
        "organizations: the other org's row is visible"
      );
    });
  }

  await t.test("cross-org writes are rejected", async () => {
    const { error: insertError } = await orgA.client.from("products").insert({
      org_id: orgB.orgId,
      name: "Cross-org intrusion",
      status: "active",
    });
    assert.ok(insertError, "insert into the other org's tenant was accepted");

    const { data: updated, error: updateError } = await orgA.client
      .from("products")
      .update({ name: "Hijacked" })
      .eq("id", seededB.productId)
      .select("id");
    if (!updateError) {
      assert.equal(updated?.length ?? 0, 0, "update reached the other org's product");
    }

    const { data: deleted, error: deleteError } = await orgA.client
      .from("products")
      .delete()
      .eq("id", seededB.productId)
      .select("id");
    if (!deleteError) {
      assert.equal(deleted?.length ?? 0, 0, "delete reached the other org's product");
    }

    const { data: stillThere, error: verifyError } = await admin
      .from("products")
      .select("id, name")
      .eq("id", seededB.productId)
      .single();
    assert.ifError(verifyError);
    assert.equal(stillThere.name, "Isolation Product b");

    // Generic probe: a no-op update filtered to the other org must reach 0 rows
    // on every org-scoped table.
    for (const table of orgScopedTables) {
      const { data, error } = await orgA.client
        .from(table)
        .update({ org_id: orgB.orgId })
        .eq("org_id", orgB.orgId)
        .select("org_id");
      if (error) continue; // denied outright
      assert.equal(data?.length ?? 0, 0, `${table}: cross-org update reached rows`);
    }
  });

  await t.test("storage: cross-org objects are unreachable in every bucket", async () => {
    const buckets = psql("select id from storage.buckets order by id");
    assert.ok(buckets.length >= 1, "no storage buckets found — enumeration looks broken");

    for (const bucket of buckets) {
      // Buckets may restrict MIME types; try an image marker first, then text.
      let markerPath = `${orgB.orgId}/isolation-check.png`;
      let { error: uploadError } = await admin.storage
        .from(bucket)
        .upload(markerPath, MARKER_PNG, { contentType: "image/png", upsert: true });
      if (uploadError) {
        markerPath = `${orgB.orgId}/isolation-check.txt`;
        ({ error: uploadError } = await admin.storage
          .from(bucket)
          .upload(markerPath, Buffer.from("isolation marker"), {
            contentType: "text/plain",
            upsert: true,
          }));
      }
      assert.ifError(uploadError);

      // Control: the object exists, so a denial below is meaningful.
      const { error: controlError } = await admin.storage
        .from(bucket)
        .createSignedUrl(markerPath, 60);
      assert.ifError(controlError);

      const { data: signed, error: signedError } = await orgA.client.storage
        .from(bucket)
        .createSignedUrl(markerPath, 60);
      assert.ok(
        signedError && !signed?.signedUrl,
        `${bucket}: org A obtained a signed URL for org B's object`
      );

      const { data: downloaded, error: downloadError } = await orgA.client.storage
        .from(bucket)
        .download(markerPath);
      assert.ok(
        downloadError && !downloaded,
        `${bucket}: org A downloaded org B's object`
      );

      const { data: listed, error: listError } = await orgA.client.storage
        .from(bucket)
        .list(orgB.orgId);
      if (!listError) {
        assert.equal(
          (listed ?? []).length,
          0,
          `${bucket}: org A listed org B's folder`
        );
      }

      const { error: intruderError } = await orgA.client.storage
        .from(bucket)
        .upload(`${orgB.orgId}/intruder.png`, MARKER_PNG, {
          contentType: "image/png",
        });
      assert.ok(
        intruderError,
        `${bucket}: org A uploaded into org B's folder`
      );
    }
  });
});
