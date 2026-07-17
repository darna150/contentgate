import assert from "node:assert/strict";
import test from "node:test";

import {
  generationSourceFields,
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
    regenerationInstruction({ replacingDraft: true, hasRevision: true }),
    /visibly change/
  );
  assert.equal(
    regenerationInstruction({ replacingDraft: false, hasRevision: false }),
    ""
  );
});
