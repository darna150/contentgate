import assert from "node:assert/strict";
import test from "node:test";
import {
  evidenceQuoteIsApproved,
  generatedCopyEvidenceIssues,
} from "./evidence-validation.ts";

const approved = [
  "ContentGate helps distributed brands create localized marketing content from approved templates, assets, and product knowledge.",
  "Brand administrators can lock layout, typography, colors, logo use, brand controls, and approval requirements so local teams cannot accidentally break the design system.",
  "Vets recommend it",
];

test("accepts an exact approved source quoted whole", () => {
  assert.equal(evidenceQuoteIsApproved(approved[0], approved), true);
});

test("accepts a substantial verbatim excerpt of an approved source", () => {
  assert.equal(
    evidenceQuoteIsApproved(
      "distributed brands create localized marketing content from approved templates",
      approved
    ),
    true
  );
});

test("accepts a short approved claim quoted in full", () => {
  // Short claims (<6 tokens) used to be unusable for grounding; now a claim
  // quoted whole is grounded regardless of length.
  assert.equal(evidenceQuoteIsApproved("Vets recommend it", approved), true);
});

test("rejects tiny fragments of a longer source", () => {
  assert.equal(evidenceQuoteIsApproved("approved templates", approved), false);
  assert.equal(evidenceQuoteIsApproved("brand controls", approved), false);
});

test("accepts verbatim excerpts despite casing and punctuation drift", () => {
  assert.equal(
    evidenceQuoteIsApproved(
      "Distributed Brands Create Localized Marketing Content",
      approved
    ),
    true
  );
});

test("rejects a paraphrase that is not present verbatim", () => {
  assert.equal(
    evidenceQuoteIsApproved(
      "ContentGate guarantees sales growth for every local team",
      approved
    ),
    false
  );
});

test("grounds reworded copy when a valid verbatim excerpt is cited", () => {
  // The exact regression: a "More strategic" refinement rewords the field, but
  // the model cites a real verbatim excerpt. This must pass.
  assert.deepEqual(
    generatedCopyEvidenceIssues({
      fields: {
        headline: "Lead every market with governed, on-brand local content",
      },
      evidence: [
        {
          field: "headline",
          source_id: "P1",
          approved_source: approved[0],
          excerpt:
            "create localized marketing content from approved templates",
        },
      ],
      approvedSources: approved,
    }),
    []
  );
});

test("grounds non-English copy against an English approved excerpt", () => {
  // Localized output shares no English tokens with the source; verbatim
  // excerpt containment does not depend on a language-specific stop list.
  assert.deepEqual(
    generatedCopyEvidenceIssues({
      fields: {
        headline: "Lokalisadong nilalaman mula sa mga aprubadong template",
      },
      evidence: [
        {
          field: "headline",
          approved_source: approved[0],
          excerpt:
            "create localized marketing content from approved templates",
        },
      ],
      approvedSources: approved,
    }),
    []
  );
});

test("rejects a field whose cited excerpt is not verbatim in any source", () => {
  assert.deepEqual(
    generatedCopyEvidenceIssues({
      fields: { headline: "Guaranteed sales growth" },
      evidence: [
        {
          field: "headline",
          approved_source: "",
          excerpt: "guaranteed sales growth for every team",
        },
      ],
      approvedSources: approved,
    }),
    ["headline: cited quote was not found verbatim in an approved source."]
  );
});

test("flags a factual field with no evidence at all", () => {
  assert.deepEqual(
    generatedCopyEvidenceIssues({
      fields: { headline: "Create localized marketing content" },
      evidence: [],
      approvedSources: approved,
    }),
    ["headline: missing approved evidence."]
  );
});

test("exempts CTA/command fields from grounding", () => {
  assert.deepEqual(
    generatedCopyEvidenceIssues({
      fields: {
        headline: "Create localized marketing content from approved templates",
        cta: "Get started",
      },
      evidence: [
        {
          field: "headline",
          approved_source: approved[0],
          excerpt:
            "create localized marketing content from approved templates",
        },
      ],
      approvedSources: approved,
    }),
    []
  );
});

test("verifies legacy citations that carry only approved_source", () => {
  // Rows generated before `excerpt` existed cite the whole source; those must
  // still verify at approval time.
  assert.deepEqual(
    generatedCopyEvidenceIssues({
      fields: { headline: "Lock layout, typography, and brand controls" },
      evidence: [{ field: "headline", approved_source: approved[1] }],
      approvedSources: approved,
    }),
    []
  );
});

test("requires approved sources to exist", () => {
  assert.deepEqual(
    generatedCopyEvidenceIssues({
      fields: { headline: "Create localized marketing content" },
      evidence: [],
      approvedSources: [],
    }),
    ["No approved claims or source text are available for generation."]
  );
});
