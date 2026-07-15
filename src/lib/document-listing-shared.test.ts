import assert from "node:assert/strict";
import { test } from "node:test";
import {
  flattenDocumentRow,
  type DocumentListRow,
} from "./document-listing-shared.ts";

function baseDocument(overrides: Partial<DocumentListRow> = {}): DocumentListRow {
  return {
    id: "document-1",
    title: "Approved Source",
    storage_path: "org/document/source.pdf",
    content_text: "Approved source text",
    created_at: "2026-07-15T00:00:00.000Z",
    paragraphs: [{ n: 1, text: "Approved source text" }],
    products: { name: "ContentGate" },
    ...overrides,
  };
}

test("flattenDocumentRow includes product, paragraph count, and indexed status", () => {
  const row = flattenDocumentRow(baseDocument());

  assert.equal(row.productName, "ContentGate");
  assert.equal(row.paragraphCount, 1);
  assert.equal(row.indexStatus, "indexed");
});

test("flattenDocumentRow handles unassigned processing documents", () => {
  const row = flattenDocumentRow(
    baseDocument({
      content_text: null,
      paragraphs: null,
      products: null,
    })
  );

  assert.equal(row.productName, null);
  assert.equal(row.paragraphCount, 0);
  assert.equal(row.indexStatus, "processing");
});

test("flattenDocumentRow handles Supabase array product joins", () => {
  const row = flattenDocumentRow(
    baseDocument({
      products: [{ name: "Array Product" }],
    })
  );

  assert.equal(row.productName, "Array Product");
});
