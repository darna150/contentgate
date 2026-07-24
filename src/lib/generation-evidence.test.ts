import assert from "node:assert/strict";
import test from "node:test";
import {
  aiEditableTemplateFields,
  composeStructuredFieldsForGeneration,
  evidenceGateForGeneratedFields,
  localeIsAllowedForGeneration,
  requiredEvidenceFieldKeys,
  studioEditableTemplateFields,
} from "./generation-evidence.ts";
import type { TemplateBundleField } from "./template-platform/manifest.ts";

const fields: TemplateBundleField[] = [
  {
    key: "headline",
    label: "Headline",
    type: "text",
    source: "ai",
    evidenceRequired: true,
  },
  {
    key: "legal",
    label: "Legal",
    type: "text",
    source: "locked",
    evidenceRequired: true,
  },
  {
    key: "cta",
    label: "CTA",
    type: "text",
    source: "user",
  },
];

test("only AI text fields are eligible for generation", () => {
  assert.deepEqual(
    aiEditableTemplateFields(fields).map((field) => field.key),
    ["headline"]
  );
});

test("evidence requirements apply only to AI-generated fields", () => {
  assert.deepEqual(requiredEvidenceFieldKeys(fields), ["headline"]);
});

test("Studio can manually edit AI and user fields, but not product or locked fields", () => {
  assert.deepEqual(
    studioEditableTemplateFields([
      ...fields,
      {
        key: "price",
        label: "Price",
        type: "text",
        source: "product",
      },
    ]).map((field) => field.key),
    ["headline", "cta"]
  );
});

test("structured generation preserves locked and user-sourced fields", () => {
  assert.deepEqual(
    composeStructuredFieldsForGeneration({
      allFieldKeys: ["headline", "legal", "cta"],
      aiFieldKeys: ["headline"],
      generatedFields: {
        headline: "Create localized marketing content from approved templates",
        legal: "AI tried to replace legal copy",
        cta: "AI tried to replace CTA",
      },
      defaultFields: {
        headline: "Default headline",
        legal: "Terms apply.",
        cta: "Shop now",
      },
    }),
    {
      headline: "Create localized marketing content from approved templates",
      legal: "Terms apply.",
      cta: "Shop now",
    }
  );
});

test("generation locale must be allowed by assignment", () => {
  assert.equal(
    localeIsAllowedForGeneration({ language: "English", allowedLocales: ["en"] }),
    true
  );
  assert.equal(
    localeIsAllowedForGeneration({ language: "Spanish", allowedLocales: ["en"] }),
    false
  );
});

test("evidence gate fails closed when required AI copy has no support", () => {
  const result = evidenceGateForGeneratedFields({
    fields: {
      headline: "Automated campaigns guarantee sales growth",
    },
    requiredEvidenceFields: ["headline"],
    evidence: [],
    approvedSources: [
      "ContentGate helps distributed brands create localized marketing content from approved templates, assets, and product knowledge.",
    ],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.issues, ["headline: missing approved evidence."]);
  }
});
