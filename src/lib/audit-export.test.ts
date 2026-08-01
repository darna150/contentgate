import assert from "node:assert/strict";
import { test } from "node:test";

import {
  auditExportFileName,
  auditRowsToCsv,
  parseAuditExportFilters,
} from "./audit-export.ts";

test("audit export filters normalize dates and bounded tokens", () => {
  const filters = parseAuditExportFilters(
    new URLSearchParams({
      from: "2026-07-01",
      to: "2026-07-31T23:59:59Z",
      action: "content.approved",
      entity_type: "generated_content",
    }),
  );

  assert.deepEqual(filters, {
    from: "2026-07-01T00:00:00.000Z",
    to: "2026-07-31T23:59:59.000Z",
    action: "content.approved",
    entityType: "generated_content",
  });
});

test("audit export filters reject reversed ranges and query operators", () => {
  assert.throws(
    () => parseAuditExportFilters(new URLSearchParams({ from: "2026-08-01", to: "2026-07-01" })),
    /from must be earlier/,
  );
  assert.throws(
    () => parseAuditExportFilters(new URLSearchParams({ action: "like.*" })),
    /unsupported characters/,
  );
});

test("audit CSV is RFC-style escaped and spreadsheet-formula safe", () => {
  const csv = auditRowsToCsv([
    {
      id: 42,
      created_at: "2026-07-31T12:00:00.000Z",
      actor_id: "11111111-1111-1111-1111-111111111111",
      action: "=HYPERLINK(\"https://example.invalid\")",
      entity_type: "generated_content",
      entity_id: "22222222-2222-2222-2222-222222222222",
      detail: { note: "quoted \"value\"\nnext line" },
    },
  ]);

  assert.ok(csv.startsWith("\uFEFF\"event_id\""));
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example\.invalid""\)"/);
  assert.ok(csv.includes('"{""note"":""quoted \\""value\\""\\nnext line""}"'));
  assert.ok(csv.endsWith("\r\n"));
});

test("audit export file names are stable and UTC based", () => {
  assert.equal(
    auditExportFileName(new Date("2026-07-31T23:59:59.000Z")),
    "contentgate-audit-20260731.csv",
  );
});
