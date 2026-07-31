import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { strToU8, unzipSync, zipSync } from "fflate";

import {
  buildWorkspacePackage,
  workspaceKeyFromName,
  type PackageBuilderDraft,
} from "./package-builder.ts";
import { preflightWorkspacePackage } from "./package.ts";

function draft(): PackageBuilderDraft {
  return {
    workspace: { key: "northstar-roasters", name: "Northstar Roasters", industry: "Specialty coffee" },
    users: [{ key: "client-admin", email: "admin@northstar.test", fullName: "Client Admin", role: "admin" }],
    products: [{ key: "atlas-brewer", name: "Atlas Brewer", description: "Approved product description." }],
    campaigns: [{ key: "launch", productKey: "atlas-brewer", name: "Launch", status: "active" }],
    documents: [{
      key: "approved-brief",
      productKey: "atlas-brewer",
      title: "Approved brief",
      content: "Approved launch copy.",
      approvalStatus: "approved",
    }],
    claims: [{
      key: "approved-claim",
      productKey: "atlas-brewer",
      text: "Approved launch copy.",
      sourceDocumentKey: "approved-brief",
      sourceParagraph: 1,
      status: "approved",
    }],
    assets: [{
      key: "packshot",
      productKey: "atlas-brewer",
      type: "packshot",
      title: "Product packshot",
      altText: "Atlas Brewer in black.",
      approvalStatus: "approved",
      file: { name: "Atlas Brewer.png", bytes: new Uint8Array([1, 2, 3]) },
    }],
    templateBundles: [{
      key: "launch-template",
      assignToProducts: ["atlas-brewer"],
      archive: {
        name: "launch-template.zip",
        bytes: zipSync({
          "bundle/manifest.json": strToU8("{}"),
          "bundle/background.png": new Uint8Array([4, 5, 6]),
        }),
      },
    }],
    qa: { productKey: "atlas-brewer", templateBundleKey: "launch-template", knowledgeQuestion: "What is approved?" },
    review: {
      preparedBy: "ContentGate Delivery",
      clientApprovalReference: "Signed brief CG-100",
      rightsConfirmed: true,
      templateSignoffConfirmed: true,
    },
  };
}

test("derives portable workspace keys from client names", () => {
  assert.equal(workspaceKeyFromName("  Northstar Roasters™  "), "northstar-roasters");
  assert.equal(workspaceKeyFromName("A"), "a-workspace");
});

test("builds a complete reviewed workspace ZIP", () => {
  const result = buildWorkspacePackage(draft());
  const files = unzipSync(result.bytes);
  assert.equal(result.fileName, "northstar-roasters-onboarding.zip");
  assert.ok(files["blueprint.json"]);
  assert.ok(files["PACKAGE_REVIEW.md"]);
  assert.ok(files["assets/packshot-Atlas-Brewer.png"]);
  assert.ok(files["templates/launch-template/manifest.json"]);
  assert.equal(result.blueprint.templateBundles?.[0].directory, "templates/launch-template");
});

test("a generated package passes the server's read-only package preflight", async () => {
  const input = draft();
  input.assets = [];
  input.templateBundles = [];
  input.qa = { productKey: "atlas-brewer", knowledgeQuestion: "What is approved?" };
  const result = buildWorkspacePackage(input);
  const root = await mkdtemp(join(tmpdir(), "contentgate-package-builder-"));
  try {
    for (const [path, bytes] of Object.entries(unzipSync(result.bytes))) {
      const output = join(root, path);
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, bytes);
    }
    const preflight = await preflightWorkspacePackage(root);
    assert.equal(preflight.ok, true, preflight.issues.map((issue) => issue.message).join("; "));
    assert.equal(preflight.prepared?.blueprint.workspace.key, "northstar-roasters");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("blocks package creation until approvals and rights are attested", () => {
  const input = draft();
  input.review.rightsConfirmed = false;
  assert.throws(() => buildWorkspacePackage(input), /usage rights/i);
});

test("rejects unsafe paths in nested template ZIPs", () => {
  const input = draft();
  input.templateBundles[0].archive.bytes = zipSync({
    "manifest.json": strToU8("{}"),
    "../secret.txt": strToU8("no"),
  });
  assert.throws(() => buildWorkspacePackage(input), /unsafe path/i);
});
