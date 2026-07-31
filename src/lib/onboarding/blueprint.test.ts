import assert from "node:assert/strict";
import test from "node:test";

import { blueprintSha256, canonicalJson, workspacePackageSha256 } from "./canonical.ts";
import {
  preflightWorkspaceBlueprint,
  WORKSPACE_BLUEPRINT_SCHEMA_VERSION,
} from "./blueprint.ts";

function validBlueprint() {
  return {
    schemaVersion: WORKSPACE_BLUEPRINT_SCHEMA_VERSION,
    workspace: { key: "acme-health", name: "Acme Health", industry: "Animal health" },
    users: [{ key: "owner", email: "owner@acme.test", fullName: "Ava Owner", role: "admin" }],
    products: [{ key: "air", name: "Nimbus Air" }],
    campaigns: [{ key: "launch", productKey: "air", name: "Launch", status: "active" }],
    documents: [{ key: "label", productKey: "air", title: "Approved label", content: "Approved claim text." }],
    claims: [{ key: "claim-1", productKey: "air", text: "Approved claim text.", sourceDocumentKey: "label", sourceParagraph: 1 }],
    assets: [{ key: "logo", type: "logo", file: "brand/logo.png" }],
    qa: { productKey: "air", templateName: "Acme launch" },
  };
}

test("preflight normalizes a valid, portable workspace blueprint", () => {
  const report = preflightWorkspaceBlueprint(validBlueprint());
  assert.equal(report.ok, true);
  assert.equal(report.blueprint?.users[0].email, "owner@acme.test");
  assert.deepEqual(report.counts, {
    users: 1,
    products: 1,
    campaigns: 1,
    documents: 1,
    claims: 1,
    assets: 1,
    templateBundles: 0,
  });
});

test("preflight rejects unresolved references and unsafe package paths", () => {
  const input = validBlueprint();
  input.campaigns[0].productKey = "missing";
  input.assets[0].file = "../secret.png";
  const report = preflightWorkspaceBlueprint(input);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((entry) => entry.code === "invalid_reference"), true);
  assert.equal(report.issues.some((entry) => entry.code === "package_path"), true);
});

test("preflight requires an admin and unique human keys", () => {
  const input = validBlueprint();
  input.users[0].role = "member";
  input.products.push({ key: "air", name: "Duplicate" });
  const report = preflightWorkspaceBlueprint(input);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((entry) => entry.message.includes("workspace admin")), true);
  assert.equal(report.issues.some((entry) => entry.code === "duplicate"), true);
});

test("preflight rejects unknown fields so package typos cannot be silently ignored", () => {
  const input = validBlueprint() as ReturnType<typeof validBlueprint> & {
    workpace?: unknown;
  };
  input.workpace = { key: "typo" };
  const report = preflightWorkspaceBlueprint(input);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((entry) => entry.code === "unknown_field"), true);
});

test("canonical hash ignores object key order but preserves array order", () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
  assert.equal(blueprintSha256({ b: 2, a: 1 }), blueprintSha256({ a: 1, b: 2 }));
  assert.notEqual(blueprintSha256({ a: [1, 2] }), blueprintSha256({ a: [2, 1] }));
});

test("package identity changes when a referenced binary changes", () => {
  const base = {
    blueprint: validBlueprint(),
    artifacts: [{ kind: "asset", key: "logo", path: "logo.png", sha256: "a".repeat(64) }],
  };
  assert.notEqual(
    workspacePackageSha256(base),
    workspacePackageSha256({
      ...base,
      artifacts: [{ ...base.artifacts[0], sha256: "b".repeat(64) }],
    }),
  );
});

test("preflight enforces reviewed v1 scale limits before allocation", () => {
  const input = validBlueprint();
  input.products = Array.from({ length: 101 }, (_, index) => ({
    key: `product-${String(index).padStart(3, "0")}`,
    name: `Product ${index}`,
  }));
  const report = preflightWorkspaceBlueprint(input);
  assert.equal(report.ok, false);
  assert.equal(
    report.issues.some(
      (entry) => entry.code === "scale_limit" && entry.path === "products",
    ),
    true,
  );
});
