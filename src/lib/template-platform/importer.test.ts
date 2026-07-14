import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  importTemplateBundle,
  TEMPLATE_BUNDLE_STORAGE_BUCKET,
  type FailedTemplateImportRunInsert,
  type TemplateBundleAssetSource,
  type TemplateBundleImportRepository,
} from "./importer.ts";
import {
  validTemplateBundleManifest,
} from "./test-fixtures.ts";
import type { CompiledTemplateBundleImport } from "./compiler.ts";

const encoder = new TextEncoder();

function sha256(data: Uint8Array) {
  return createHash("sha256").update(data).digest("hex");
}

function manifestWithRealAssetHashes() {
  const sources = validTemplateBundleManifest.assets.map((asset) => {
    const data = encoder.encode(`payload:${asset.path}`);
    return {
      path: asset.path,
      data,
      contentType: asset.mimeType,
      sha256: sha256(data),
    };
  });

  return {
    manifest: {
      ...validTemplateBundleManifest,
      assets: validTemplateBundleManifest.assets.map((asset) => ({
        ...asset,
        sha256: sources.find((source) => source.path === asset.path)?.sha256 ?? asset.sha256,
      })),
      fonts: validTemplateBundleManifest.fonts.map((font) => {
        const asset = validTemplateBundleManifest.assets.find(
          (candidate) => candidate.key === font.asset
        );
        const source = asset
          ? sources.find((candidate) => candidate.path === asset.path)
          : null;
        return {
          ...font,
          sha256: source?.sha256 ?? font.sha256,
        };
      }),
    },
    sources: sources.map(({ path, data, contentType }) => ({ path, data, contentType })),
  };
}

function fakeRepository(existingFamilyId: string | null = null) {
  const calls: string[] = [];
  const uploads: Array<{
    bucket: string;
    path: string;
    contentType: string | null;
  }> = [];
  const inserted: CompiledTemplateBundleImport["rows"][] = [];
  const failed: FailedTemplateImportRunInsert[] = [];

  const repository: TemplateBundleImportRepository = {
    async findTemplateFamilyId() {
      calls.push("find-family");
      return existingFamilyId;
    },
    async uploadTemplateAsset(input) {
      calls.push(`upload:${input.path}`);
      uploads.push({
        bucket: input.bucket,
        path: input.path,
        contentType: input.contentType,
      });
    },
    async insertCompiledTemplateBundle(rows) {
      calls.push("insert-compiled");
      inserted.push(rows);
    },
    async insertFailedTemplateImportRun(row) {
      calls.push("insert-failed");
      failed.push(row);
    },
  };

  return { calls, uploads, inserted, failed, repository };
}

const fixedIds = {
  familyId: "11111111-1111-4111-8111-111111111111",
  versionId: "22222222-2222-4222-8222-222222222222",
  importRunId: "33333333-3333-4333-8333-333333333333",
  variantIds: {
    square: "44444444-4444-4444-8444-444444444444",
  },
  assetIds: {
    "inter-bold-file": "55555555-5555-4555-8555-555555555555",
    "square-reference": "66666666-6666-4666-8666-666666666666",
    "square-background": "77777777-7777-4777-8777-777777777777",
  },
};

const baseRequest = {
  orgId: "99999999-9999-4999-8999-999999999999",
  createdBy: "88888888-8888-4888-8888-888888888888",
  storagePrefix: "template-bundles/contentgate-local-friendly/v1",
  now: new Date("2026-07-14T10:00:00.000Z"),
  ids: fixedIds,
};

test("uploads every verified asset before inserting compiled template rows", async () => {
  const { manifest, sources } = manifestWithRealAssetHashes();
  const repo = fakeRepository();

  const result = await importTemplateBundle(
    { ...baseRequest, manifest, assets: sources },
    repo.repository
  );

  assert.equal(result.ok, true);
  assert.equal(repo.failed.length, 0);
  assert.equal(repo.inserted.length, 1);
  assert.deepEqual(
    repo.calls.map((call) => call.startsWith("upload:") ? "upload" : call),
    ["find-family", "upload", "upload", "upload", "insert-compiled"]
  );
  assert.deepEqual(
    repo.uploads.map((upload) => upload.bucket),
    [
      TEMPLATE_BUNDLE_STORAGE_BUCKET,
      TEMPLATE_BUNDLE_STORAGE_BUCKET,
      TEMPLATE_BUNDLE_STORAGE_BUCKET,
    ]
  );
});

test("reuses an existing template family id when importing a new version", async () => {
  const { manifest, sources } = manifestWithRealAssetHashes();
  const repo = fakeRepository("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

  const result = await importTemplateBundle(
    { ...baseRequest, manifest, assets: sources },
    repo.repository
  );

  assert.equal(result.ok, true);
  assert.equal(repo.inserted[0].family.id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(repo.inserted[0].version.family_id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
});

test("records a failed import and skips uploads when an asset checksum is wrong", async () => {
  const { manifest, sources } = manifestWithRealAssetHashes();
  const repo = fakeRepository();
  const brokenSources: TemplateBundleAssetSource[] = [
    { ...sources[0], data: encoder.encode("wrong bytes") },
    ...sources.slice(1),
  ];

  const result = await importTemplateBundle(
    { ...baseRequest, manifest, assets: brokenSources },
    repo.repository
  );

  assert.equal(result.ok, false);
  assert.equal(repo.uploads.length, 0);
  assert.equal(repo.inserted.length, 0);
  assert.equal(repo.failed.length, 1);
  assert.equal(repo.failed[0].status, "failed");
  assert.equal(repo.failed[0].template_version_id, null);
  assert.equal(
    repo.failed[0].report.issues.some((issue) => issue.message.includes("checksum mismatch")),
    true
  );
});

test("records a failed import when manifest validation fails", async () => {
  const { manifest, sources } = manifestWithRealAssetHashes();
  const repo = fakeRepository();
  const invalid = {
    ...manifest,
    variants: [],
  };

  const result = await importTemplateBundle(
    { ...baseRequest, manifest: invalid, assets: sources },
    repo.repository
  );

  assert.equal(result.ok, false);
  assert.equal(repo.uploads.length, 0);
  assert.equal(repo.inserted.length, 0);
  assert.equal(repo.failed.length, 1);
  assert.equal(
    repo.failed[0].report.issues.some((issue) => issue.path === "variants"),
    true
  );
});
