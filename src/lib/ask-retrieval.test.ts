import assert from "node:assert/strict";
import test from "node:test";

import { buildAskRetrievalQueries, fuseAskRetrievalEvidence } from "./ask-retrieval.ts";

test("compound Ask questions preserve the whole intent and add bounded retrieval clauses", () => {
  assert.deepEqual(
    buildAskRetrievalQueries("Who can use it and how often is it administered?"),
    ["Who can use it and how often is it administered?", "Who can use it", "how often is it administered?"]
  );
  assert.deepEqual(buildAskRetrievalQueries("Compare the two approved options"), ["Compare the two approved options"]);
});

test("retrieval fusion keeps the best evidence identity and limits source domination", () => {
  const rows = fuseAskRetrievalEvidence([
    [
      { document_id: "doc-a", document_title: "A", paragraph_n: 1, paragraph_text: "A1", relevance: 0.3 },
      { document_id: "doc-a", document_title: "A", paragraph_n: 2, paragraph_text: "A2", relevance: 0.2 },
      { document_id: "doc-a", document_title: "A", paragraph_n: 3, paragraph_text: "A3", relevance: 0.1 },
      { document_id: "doc-a", document_title: "A", paragraph_n: 4, paragraph_text: "A4", relevance: 0.05 },
    ],
    [
      { document_id: "doc-a", document_title: "A", paragraph_n: 1, paragraph_text: "A1", relevance: 0.8 },
      { document_id: "doc-b", document_title: "B", paragraph_n: 1, paragraph_text: "B1", relevance: 0.7 },
    ],
  ]);

  assert.equal(rows.find((row) => row.document_id === "doc-a" && row.paragraph_n === 1)?.relevance, 0.8);
  assert.equal(rows.filter((row) => row.document_id === "doc-a").length, 3);
  assert.equal(rows.some((row) => row.document_id === "doc-b"), true);
});
