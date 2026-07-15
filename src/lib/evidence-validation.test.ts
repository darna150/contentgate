import assert from "node:assert/strict";
import test from "node:test";
import { evidenceSourceIsApproved } from "./evidence-validation.ts";

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
