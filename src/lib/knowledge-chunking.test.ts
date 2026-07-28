import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContextualEmbeddingInputs,
  expandKnowledgeEvidenceWithNeighbors,
} from "./knowledge-chunking.ts";
import { segmentParagraphs } from "./paragraphs.ts";

test("structure-aware segmentation attaches headings and preserves list groups", () => {
  assert.deepEqual(
    segmentParagraphs(
      "APPROVED DIRECTIONS\n\nUse monthly.\n\nELIGIBILITY:\n\n- At least 8 weeks\n- At least 4 pounds"
    ),
    [
      { n: 1, text: "APPROVED DIRECTIONS\nUse monthly." },
      { n: 2, text: "ELIGIBILITY:\n- At least 8 weeks\n- At least 4 pounds" },
    ]
  );
});

test("structure-aware segmentation bounds oversized extracted blocks without losing words", () => {
  const source = Array.from({ length: 260 }, (_, index) => `word${index}`).join(" ");
  const paragraphs = segmentParagraphs(source);

  assert.ok(paragraphs.length > 1);
  assert.ok(paragraphs.every((paragraph) => paragraph.text.length <= 1_400));
  assert.equal(
    paragraphs.flatMap((paragraph) => paragraph.text.split(/\s+/)).length,
    260
  );

  const longToken = "x".repeat(2_900);
  const tokenParagraphs = segmentParagraphs(longToken);
  assert.ok(tokenParagraphs.every((paragraph) => paragraph.text.length <= 1_400));
  assert.equal(tokenParagraphs.map((paragraph) => paragraph.text).join(""), longToken);
});

test("contextual embedding inputs carry section and adjacent paragraph context", () => {
  const paragraphs = [
    { n: 1, text: "ELIGIBILITY" },
    { n: 2, text: "Dogs must be at least 8 weeks old." },
    { n: 3, text: "Dogs must weigh at least 4 pounds." },
  ];
  const inputs = buildContextualEmbeddingInputs("Approved Guide", paragraphs);

  assert.match(inputs[1], /Section: ELIGIBILITY/);
  assert.match(inputs[1], /Previous context: ELIGIBILITY/);
  assert.match(inputs[1], /Next context: Dogs must weigh at least 4 pounds/);
  assert.match(inputs[1], /Source paragraph 2: Dogs must be at least 8 weeks old/);
});

test("neighbor expansion adds only adjacent paragraphs from the same approved corpus", () => {
  const corpus = [1, 2, 3, 4].map((paragraphNumber) => ({
    document_id: "doc-a",
    document_title: "Approved Guide",
    paragraph_n: paragraphNumber,
    paragraph_text: `Paragraph ${paragraphNumber}`,
  }));
  const seeds = [{ ...corpus[2], relevance: 0.9 }];
  const expanded = expandKnowledgeEvidenceWithNeighbors({ seeds, corpus, radius: 1 });

  assert.deepEqual(expanded.map((paragraph) => paragraph.paragraph_n), [2, 3, 4]);
  assert.equal(expanded[1].relevance, 0.9);
  assert.equal(expanded[0].relevance, 0.81);
});
