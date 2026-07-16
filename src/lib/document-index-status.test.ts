import assert from "node:assert/strict";
import { test } from "node:test";
import { documentIndexStatus } from "./document-index-status.ts";

test("marks documents with citable paragraphs as indexed", () => {
  assert.equal(
    documentIndexStatus({
      contentText: "Approved source text",
      paragraphs: [{ n: 1, text: "Approved source text" }],
      storagePath: null,
    }),
    "indexed"
  );
});

test("marks extracted text without paragraphs as failed", () => {
  assert.equal(
    documentIndexStatus({
      contentText: "Text that could not be segmented",
      paragraphs: [],
      storagePath: null,
    }),
    "failed"
  );
});

test("marks uploaded documents awaiting extraction as processing", () => {
  assert.equal(
    documentIndexStatus({
      contentText: null,
      paragraphs: null,
      storagePath: "org/document/file.pdf",
    }),
    "processing"
  );
});
