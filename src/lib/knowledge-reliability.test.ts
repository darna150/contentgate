import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKnowledgeContext,
  finalizeKnowledgeAnswer,
  normalizeRetrievedParagraphs,
  verifyKnowledgeCitations,
} from "./knowledge-reliability.ts";
import { normalizeParagraphs } from "./paragraphs.ts";

const evidence = normalizeRetrievedParagraphs([
  {
    document_id: "doc-a",
    document_title: "Approved Guide",
    paragraph_n: 4,
    paragraph_text: "Daily use helps reduce tartar buildup in dogs.",
    relevance: 0.8,
  },
]);

test("normalizes retrieved evidence and preserves stable paragraph identity", () => {
  assert.deepEqual(evidence, [
    {
      document_id: "doc-a",
      document_title: "Approved Guide",
      paragraph_n: 4,
      paragraph_text: "Daily use helps reduce tartar buildup in dogs.",
      relevance: 0.8,
    },
  ]);
  assert.match(buildKnowledgeContext(evidence), /document_id=doc-a paragraph=4/);
});

test("normalizes historical paragraph JSON without changing stable numbers", () => {
  assert.deepEqual(
    normalizeParagraphs([
      { n: 7, text: " Approved paragraph " },
      "Historical string paragraph",
      { n: 7, text: "Duplicate identity" },
    ]),
    [
      { n: 7, text: "Approved paragraph" },
      { n: 2, text: "Historical string paragraph" },
    ]
  );
});

test("accepts only excerpts from the exact retrieved document paragraph", () => {
  assert.deepEqual(
    verifyKnowledgeCitations(
      [
        {
          document_id: "doc-a",
          paragraph_n: 4,
          excerpt: "helps reduce tartar buildup",
        },
        {
          document_id: "doc-a",
          paragraph_n: 5,
          excerpt: "helps reduce tartar buildup",
        },
      ],
      evidence
    ),
    [
      {
        document_id: "doc-a",
        document_title: "Approved Guide",
        paragraph_n: 4,
        excerpt: "helps reduce tartar buildup",
      },
    ]
  );
});

test("fails safely when a supported answer has no verified citation", () => {
  assert.deepEqual(
    finalizeKnowledgeAnswer({
      answer: "An unsupported answer",
      notFound: false,
      citations: [],
    }),
    {
      answer: "I could not verify an answer in the approved source documents.",
      citations: [],
      not_found: true,
    }
  );
});

test("keeps a supported answer with inspectable evidence", () => {
  const citations = verifyKnowledgeCitations(
    [
      {
        document_id: "doc-a",
        paragraph_n: 4,
        excerpt: "Daily use helps reduce tartar buildup in dogs.",
      },
    ],
    evidence
  );

  assert.equal(
    finalizeKnowledgeAnswer({
      answer: "Daily use can help reduce tartar buildup.",
      notFound: false,
      citations,
    }).not_found,
    false
  );
});
