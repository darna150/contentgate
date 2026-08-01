import assert from "node:assert/strict";
import test from "node:test";

import {
  meaningfulVariationIssues,
  revisionContractKind,
  revisionLengthIssues,
  revisionAvailabilityIssue,
  semanticRevisionCriterion,
} from "./revision-contract.ts";
import { REVISION_OPTIONS } from "./templates.ts";

const previousFields = {
  headline: "RUN ON AIR",
  subheadline_1: "Introducing the new Nimbus 1",
  optional: "",
};

test("Shorter allows a concise protected field to remain unchanged when the copy is shorter overall", () => {
  const issues = revisionLengthIssues({
    revision: "shorter",
    editableFields: ["headline", "subheadline_1", "optional"],
    previousFields,
    generatedFields: {
      headline: "RUN ON AIR",
      subheadline_1: "Nimbus 1 is here.",
      optional: "",
    },
  });

  assert.deepEqual(issues, []);
});

test("Shorter does not add copy to a previously empty optional field", () => {
  const issues = revisionLengthIssues({
    revision: "shorter",
    editableFields: ["optional"],
    previousFields,
    generatedFields: { optional: "New optional copy" },
  });

  assert.deepEqual(issues, [
    "optional: must remain empty when making the current copy shorter",
  ]);
});

test("Shorter accepts a rewrite when at least one field and the total copy are shorter", () => {
  assert.deepEqual(
    revisionLengthIssues({
      revision: "shorter",
      editableFields: ["headline", "subheadline_1"],
      previousFields,
      generatedFields: {
        headline: "RUN AIR",
        subheadline_1: "Meet Nimbus 1",
      },
    }),
    []
  );
});

test("Shorter rejects a result that is not shorter overall", () => {
  const issues = revisionLengthIssues({
    revision: "shorter",
    editableFields: ["headline", "subheadline_1"],
    previousFields,
    generatedFields: {
      headline: "RUN ON AIR TODAY",
      subheadline_1: "Introducing the new Nimbus 1",
    },
  });
  assert.ok(issues.some((issue) => issue.startsWith("headline: became longer")));
  assert.ok(issues.some((issue) => issue.startsWith("copy: must be shorter overall")));
});

test("Longer allows a concise protected field to remain unchanged when the copy is longer overall", () => {
  const issues = revisionLengthIssues({
    revision: "longer",
    editableFields: ["headline", "subheadline_1"],
    previousFields,
    generatedFields: {
      headline: "RUN ON AIR",
      subheadline_1: "Meet the new, cloud-soft Nimbus 1 running shoe.",
    },
  });

  assert.deepEqual(issues, []);
});

test("Non-length refinements do not impose a character-count contract", () => {
  assert.deepEqual(
    revisionLengthIssues({
      revision: "strategic",
      editableFields: ["headline"],
      previousFields,
      generatedFields: { headline: "RUN LIGHT. FEEL FAST." },
    }),
    []
  );
});

test("Every refinement has an enforceable contract", () => {
  assert.deepEqual(
    Object.fromEntries(
      REVISION_OPTIONS.map((option) => [option.key, revisionContractKind(option.key)])
    ),
    {
      shorter: "length",
      longer: "length",
      strategic: "semantic",
      playful: "semantic",
      urgent: "semantic",
      simpler: "semantic",
      brand_voice: "semantic",
      proof_point: "semantic",
      benefit: "semantic",
    }
  );
});

test("Every semantic refinement exposes a strict evaluation criterion", () => {
  for (const option of REVISION_OPTIONS.slice(2)) {
    assert.ok(semanticRevisionCriterion(option.key)?.length, option.key);
  }
});

test("Generate rejects a cosmetic one-word change from the authored reference", () => {
  const issues = meaningfulVariationIssues({
    editableFields: ["headline", "subheadline_1", "subheadline_2"],
    previousFields: {
      headline: "RUN ON AIR",
      subheadline_1: "INTRODUCING THE NEW NIMBUS 1",
      subheadline_2: "CLOUD-SOFT CUSHIONING MEETS REAL-WORLD SPEED",
    },
    generatedFields: {
      headline: "RUN ON AIR",
      subheadline_1: "Meet the new Nimbus 1.",
      subheadline_2: "Cloud-soft cushioning meets real-world speed.",
    },
  });

  assert.equal(issues.length, 2);
  assert.match(issues[0], /change at least 2 of 3/);
  assert.match(issues[1], /wording still overlaps/);
});

test("Generate accepts a visibly different rewrite", () => {
  assert.deepEqual(
    meaningfulVariationIssues({
      editableFields: ["headline", "subheadline_1", "subheadline_2"],
      previousFields: {
        headline: "RUN ON AIR",
        subheadline_1: "INTRODUCING THE NEW NIMBUS 1",
        subheadline_2: "CLOUD-SOFT CUSHIONING MEETS REAL-WORLD SPEED",
      },
      generatedFields: {
        headline: "LAND SOFT. MOVE FAST.",
        subheadline_1: "Daily miles feel lighter in Nimbus 1.",
        subheadline_2: "Cloud-soft cushioning supports real-world pace.",
      },
    }),
    []
  );
});

test("disables a longer refinement when a field is already at its format limit", () => {
  assert.match(
    revisionAvailabilityIssue({
      revision: "longer",
      editableFields: ["headline", "subheadline"],
      currentFields: { headline: "Exactly ten", subheadline: "Room" },
      requiredFields: ["headline"],
      fieldLimits: { headline: { max_chars: 11 }, subheadline: { max_chars: 20 } },
    }) ?? "",
    /already at its maximum length/
  );
});
