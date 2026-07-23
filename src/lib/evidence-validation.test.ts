import assert from "node:assert/strict";
import test from "node:test";
import {
  evidenceSourceIsApproved,
  generatedCopyEvidenceIssues,
} from "./evidence-validation.ts";

const approved = [
  "ContentGate helps distributed brands create localized marketing content from approved templates, assets, and product knowledge.",
  "Brand administrators can lock layout, typography, colors, logo use, brand controls, and approval requirements so local teams cannot accidentally break the design system.",
  "Local users can edit approved fields such as headline, supporting copy, location detail, call to action, date, offer, market language, and image selection.",
];

test("accepts exact approved source sentences", () => {
  assert.equal(
    evidenceSourceIsApproved(approved[0], approved),
    true
  );
});

test("accepts substantial excerpts from approved source sentences", () => {
  assert.equal(
    evidenceSourceIsApproved(
      "distributed brands create localized marketing content from approved templates",
      approved
    ),
    true
  );
});

test("rejects tiny fragments that used to validate broad claims", () => {
  assert.equal(evidenceSourceIsApproved("approved templates", approved), false);
  assert.equal(evidenceSourceIsApproved("local users", approved), false);
});

test("rejects unsupported paraphrases with only partial token overlap", () => {
  assert.equal(
    evidenceSourceIsApproved(
      "ContentGate guarantees sales growth for every local team using automated campaigns",
      approved
    ),
    false
  );
});

test("accepts near-exact source text despite punctuation and casing drift", () => {
  assert.equal(
    evidenceSourceIsApproved(
      "brand administrators lock layout typography colors logo use brand controls and approval requirements",
      approved
    ),
    true
  );
});

test("generated copy evidence rejects unsupported field copy", () => {
  assert.deepEqual(
    generatedCopyEvidenceIssues({
      fields: {
        headline: "Automated campaigns guarantee sales growth",
      },
      evidence: [
        {
          field: "headline",
          approved_source: approved[0],
        },
      ],
      approvedSources: approved,
    }),
    ["headline: generated copy is not supported by its approved evidence."]
  );
});

test("generated copy evidence accepts supported non-cta fields", () => {
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
        },
      ],
      approvedSources: approved,
    }),
    []
  );
});

test("generated copy evidence requires approved sources", () => {
  assert.deepEqual(
    generatedCopyEvidenceIssues({
      fields: { headline: "Create localized marketing content" },
      evidence: [],
      approvedSources: [],
    }),
    ["No approved claims or source text are available for generation."]
  );
});
