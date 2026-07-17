import assert from "node:assert/strict";
import test from "node:test";

import {
  changedGeneratedFields,
  changedPrimaryTitleField,
  generationSourceFields,
  primaryTitleField,
  primaryTitleFieldTooSimilar,
  regenerationInstruction,
} from "./generation-context.ts";

test("replace/refine generation uses the current draft copy before sticky campaign fields", () => {
  const fields = generationSourceFields(
    {
      structured_fields: {
        headline: "Current edited headline",
        cta: "Current CTA",
      },
      prompt_context: {
        campaign_source_fields: {
          headline: "Original campaign headline",
          cta: "Original CTA",
        },
        generated_fields: {
          headline: "Previous generated headline",
          cta: "Previous generated CTA",
        },
      },
    },
    { preferCurrentDraft: true }
  );

  assert.deepEqual(fields, {
    headline: "Current edited headline",
    cta: "Current CTA",
  });
});

test("size adaptation keeps the sticky campaign source fields", () => {
  const fields = generationSourceFields({
    structured_fields: {
      headline: "Current size headline",
    },
    prompt_context: {
      campaign_source_fields: {
        headline: "Original campaign headline",
      },
    },
  });

  assert.deepEqual(fields, {
    headline: "Original campaign headline",
  });
});

test("draft regeneration prompt asks for visible new wording", () => {
  assert.match(
    regenerationInstruction({ replacingDraft: true, hasRevision: false }),
    /fresh alternative version/
  );
  assert.match(
    regenerationInstruction({ replacingDraft: true, hasRevision: false }),
    /Rewrite the headline\/title field/
  );
  assert.match(
    regenerationInstruction({ replacingDraft: true, hasRevision: true }),
    /Rewrite the headline\/title field/
  );
  assert.equal(
    regenerationInstruction({ replacingDraft: false, hasRevision: false }),
    ""
  );
});

test("draft regeneration requires the primary title field to change", () => {
  assert.equal(primaryTitleField(["local_detail", "headline", "cta"]), "headline");
  assert.equal(primaryTitleField(["subject", "body", "cta"]), "subject");

  assert.equal(
    changedPrimaryTitleField({
      before: {
        headline: "Local offers, ready in minutes",
        subheadline: "Create localized marketing content.",
      },
      after: {
        headline: "Local offers, ready in minutes",
        subheadline: "Create brand-approved localized content.",
      },
      fieldOrder: ["headline", "subheadline"],
    }),
    false
  );

  assert.equal(
    changedPrimaryTitleField({
      before: { headline: "Local offers, ready in minutes" },
      after: { headline: "Launch local offers faster" },
      fieldOrder: ["headline", "subheadline"],
    }),
    true
  );
});

test("draft regeneration flags a headline that only swapped a word or two", () => {
  assert.equal(
    primaryTitleFieldTooSimilar({
      before: { headline: "Locked templates and approvals—ready locally" },
      after: { headline: "Locked templates & approvals—ready locally" },
      fieldOrder: ["headline", "subheadline"],
    }),
    true
  );

  assert.equal(
    primaryTitleFieldTooSimilar({
      before: { headline: "Locked templates and approvals—ready locally" },
      after: { headline: "Launch every local campaign without waiting on approvals" },
      fieldOrder: ["headline", "subheadline"],
    }),
    false
  );

  assert.equal(
    primaryTitleFieldTooSimilar({
      before: { headline: "" },
      after: { headline: "Launch local campaigns faster" },
      fieldOrder: ["headline", "subheadline"],
    }),
    false
  );
});

test("draft regeneration detects unchanged generated fields", () => {
  assert.equal(
    changedGeneratedFields({
      before: { headline: "Local offers", cta: "Create content" },
      after: { headline: " Local   offers ", cta: "Create content" },
      fieldOrder: ["headline", "cta"],
    }),
    false
  );

  assert.equal(
    changedGeneratedFields({
      before: { headline: "Local offers", cta: "Create content" },
      after: { headline: "Fresh local offers", cta: "Create content" },
      fieldOrder: ["headline", "cta"],
    }),
    true
  );
});
