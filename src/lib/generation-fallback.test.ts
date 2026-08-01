import assert from "node:assert/strict";
import test from "node:test";

import { sourceBackedFallbackCandidates } from "./generation-fallback.ts";

test("builds deterministic source-backed candidates and clears optional fields", () => {
  const candidates = sourceBackedFallbackCandidates({
    editableFields: ["headline", "subheadline", "optional_note"],
    requiredFields: ["headline", "subheadline"],
    sources: [{ text: "A longer approved source" }, { text: "Short proof" }],
  });
  assert.equal(candidates.length, 2);
  assert.deepEqual(candidates[0].fields, {
    headline: "Short proof",
    subheadline: "A longer approved source",
    optional_note: "",
  });
  assert.equal(candidates[0].evidence.length, 2);
  assert.equal(candidates[0].evidence[0].excerpt, "Short proof");
});
test("returns no fallback when no approved source exists", () => {
  assert.deepEqual(
    sourceBackedFallbackCandidates({
      editableFields: ["headline"],
      requiredFields: ["headline"],
      sources: [],
    }),
    []
  );
});
