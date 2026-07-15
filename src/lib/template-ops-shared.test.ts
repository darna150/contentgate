import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mapTemplateExportHistoryRow,
  templateOpsPageResult,
  type TemplateExportHistoryRow,
} from "./template-ops-shared.ts";

function baseJob(
  overrides: Partial<TemplateExportHistoryRow> = {}
): TemplateExportHistoryRow {
  return {
    id: "job-1",
    status: "completed",
    output_format: "png",
    output_storage_path: "org/content/render.png",
    created_at: "2026-07-15T00:00:00.000Z",
    completed_at: "2026-07-15T00:01:00.000Z",
    template_version_id: "version-1",
    template_variant_id: "variant-1",
    generated_content: {
      title: "Approved draft",
      created_by: "user-1",
      creator: { full_name: "Debbie Melgarejo" },
    },
    template_variants: { variant_key: "square", label: "Square" },
    ...overrides,
  };
}

test("mapTemplateExportHistoryRow flattens render job joins", () => {
  const item = mapTemplateExportHistoryRow(baseJob());

  assert.deepEqual(item, {
    id: "job-1",
    status: "completed",
    outputFormat: "png",
    outputStoragePath: "org/content/render.png",
    createdAt: "2026-07-15T00:00:00.000Z",
    completedAt: "2026-07-15T00:01:00.000Z",
    templateVersionId: "version-1",
    templateVariantId: "variant-1",
    variantKey: "square",
    variantLabel: "Square",
    contentTitle: "Approved draft",
    exportedById: "user-1",
    exportedByName: "Debbie Melgarejo",
  });
});

test("mapTemplateExportHistoryRow tolerates missing optional joins", () => {
  const item = mapTemplateExportHistoryRow(
    baseJob({
      output_storage_path: null,
      completed_at: null,
      generated_content: null,
      template_variants: null,
    })
  );

  assert.equal(item.outputStoragePath, null);
  assert.equal(item.completedAt, null);
  assert.equal(item.variantKey, null);
  assert.equal(item.variantLabel, null);
  assert.equal(item.contentTitle, null);
  assert.equal(item.exportedById, null);
  assert.equal(item.exportedByName, null);
});

test("mapTemplateExportHistoryRow handles Supabase array joins", () => {
  const item = mapTemplateExportHistoryRow(
    baseJob({
      generated_content: [
        {
          title: "Array joined draft",
          created_by: "user-2",
          creator: [{ full_name: "Approver User" }],
        },
      ],
      template_variants: [{ variant_key: "story", label: "Story" }],
    })
  );

  assert.equal(item.contentTitle, "Array joined draft");
  assert.equal(item.exportedById, "user-2");
  assert.equal(item.exportedByName, "Approver User");
  assert.equal(item.variantKey, "story");
  assert.equal(item.variantLabel, "Story");
});

test("templateOpsPageResult returns one extra row as a next cursor signal", () => {
  const page = templateOpsPageResult(["a", "b", "c"], 20, 2);

  assert.deepEqual(page.rows, ["a", "b"]);
  assert.equal(page.hasMore, true);
  assert.equal(page.nextCursor, "22");
});

test("templateOpsPageResult omits the next cursor on the final page", () => {
  const page = templateOpsPageResult(["a", "b"], 20, 2);

  assert.deepEqual(page.rows, ["a", "b"]);
  assert.equal(page.hasMore, false);
  assert.equal(page.nextCursor, null);
});
