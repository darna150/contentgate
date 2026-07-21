import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExtractiveKnowledgeAnswer,
  buildKnowledgeContext,
  finalizeKnowledgeAnswer,
  normalizeRetrievedParagraphs,
  rankKnowledgeEvidence,
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

test("ranks fallback evidence by meaningful query overlap", () => {
  const ranked = rankKnowledgeEvidence("Who is ContentGate for?", [
    {
      document_id: "doc-a",
      document_title: "Unrelated geography",
      paragraph_n: 1,
      paragraph_text: "Paris is the capital of France.",
    },
    {
      document_id: "doc-b",
      document_title: "ContentGate overview",
      paragraph_n: 2,
      paragraph_text:
        "ContentGate is built for distributed organizations where local operators need approved content.",
    },
  ]);

  assert.equal(ranked[0]?.document_id, "doc-b");
});

// Retrieval-quality fixture set: (question → expected top paragraph).
// These benchmark rankKnowledgeEvidence's client-side fallback ranking.
// Note: the function uses exact token matching (no stemming), so test corpus
// terms must appear verbatim in both questions and paragraphs.
const RETRIEVAL_CORPUS = [
  {
    document_id: "doc-duration",
    document_title: "Protection Duration Guide",
    paragraph_n: 1,
    paragraph_text:
      "This product provides full monthly protection — one treatment covers protection for a full month duration.",
  },
  {
    document_id: "doc-eligibility",
    document_title: "Eligibility Requirements",
    paragraph_n: 1,
    paragraph_text:
      "Eligibility requires minimum weight above four pounds and minimum age above eight weeks.",
  },
  {
    document_id: "doc-admin",
    document_title: "ContentGate Admin Controls",
    paragraph_n: 1,
    paragraph_text:
      "Administrators control layout permissions by locking typography and color settings.",
  },
  {
    document_id: "doc-localize",
    document_title: "Localization Overview",
    paragraph_n: 1,
    paragraph_text:
      "ContentGate generates localized content from approved templates, claims, and source documents.",
  },
];

test("fixture: protection duration question ranks the duration paragraph first", () => {
  const ranked = rankKnowledgeEvidence(
    "What is the protection duration for one monthly treatment?",
    RETRIEVAL_CORPUS
  );
  // "protection", "duration", "monthly" all appear in doc-duration p1 only
  assert.equal(ranked[0]?.document_id, "doc-duration");
});

test("fixture: eligibility requirements question ranks the eligibility paragraph first", () => {
  const ranked = rankKnowledgeEvidence(
    "What eligibility minimum weight age requirements apply?",
    RETRIEVAL_CORPUS
  );
  // "eligibility", "minimum", "weight", "age" all appear in doc-eligibility p1
  assert.equal(ranked[0]?.document_id, "doc-eligibility");
});

test("fixture: admin locking question ranks the admin paragraph first", () => {
  const ranked = rankKnowledgeEvidence(
    "How administrators control locking typography permissions?",
    RETRIEVAL_CORPUS
  );
  // "administrators", "locking", "typography" appear in doc-admin p1
  assert.equal(ranked[0]?.document_id, "doc-admin");
});

test("fixture: empty question returns no evidence", () => {
  const ranked = rankKnowledgeEvidence("", RETRIEVAL_CORPUS);
  assert.deepEqual(ranked, []);
});

test("extractive fallback remains cited and source-bound", () => {
  assert.deepEqual(
    buildExtractiveKnowledgeAnswer("Who is ContentGate for?", [
      {
        document_id: "doc-b",
        document_title: "ContentGate overview",
        paragraph_n: 2,
        paragraph_text:
          "ContentGate is built for distributed organizations where local operators need approved content.",
      },
    ]),
    {
      answer:
        "ContentGate is built for distributed organizations where local operators need approved content.",
      citations: [
        {
          document_id: "doc-b",
          document_title: "ContentGate overview",
          paragraph_n: 2,
          excerpt:
            "ContentGate is built for distributed organizations where local operators need approved content.",
        },
      ],
      not_found: false,
    }
  );
});
