import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { preflightWorkspacePackage } from "./package.ts";

test("preflight rejects a claim whose cited paragraph was not extracted", async () => {
  const root = await mkdtemp(join(tmpdir(), "contentgate-onboarding-package-"));
  try {
    await writeFile(join(root, "source.txt"), "Only one citation-ready paragraph.\n");
    await writeFile(
      join(root, "blueprint.json"),
      JSON.stringify({
        schemaVersion: "contentgate-workspace-v1",
        workspace: { key: "citation-qa", name: "Citation QA" },
        users: [
          {
            key: "owner",
            email: "owner@example.com",
            role: "admin",
          },
        ],
        products: [{ key: "product", name: "Product" }],
        documents: [
          {
            key: "source",
            productKey: "product",
            title: "Source",
            file: "source.txt",
            approvalStatus: "approved",
          },
        ],
        claims: [
          {
            key: "claim",
            productKey: "product",
            text: "Approved claim",
            sourceDocumentKey: "source",
            sourceParagraph: 2,
            status: "approved",
          },
        ],
      }),
    );

    const result = await preflightWorkspacePackage(root);

    assert.equal(result.ok, false);
    assert.equal(result.prepared, null);
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.path === "claims.0.sourceParagraph" &&
          issue.message.includes("Paragraph 2 does not exist"),
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
