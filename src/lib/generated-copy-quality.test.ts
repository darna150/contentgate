import assert from "node:assert/strict";
import test from "node:test";

import {
  formatGeneratedCopyQualityIssues,
  generatedCopyQualityIssues,
} from "./generated-copy-quality.ts";

test("generated copy quality rejects visibly truncated thoughts", () => {
  const issues = generatedCopyQualityIssues(
    {
      headline: "Localized content without the back-",
      subheadline: "Create approved assets for",
      proof_note: "Templates, assets,",
      cta: "Get Started",
    },
    ["headline", "subheadline", "proof_note", "cta"]
  );

  assert.deepEqual(Object.keys(issues).sort(), [
    "headline",
    "proof_note",
    "subheadline",
  ]);
  assert.deepEqual(issues.cta, undefined);
  assert.match(formatGeneratedCopyQualityIssues(issues).join("\n"), /broken hyphenated word|dangling dash/);
});

test("generated copy quality rejects unresolved placeholder tokens", () => {
  const issues = generatedCopyQualityIssues(
    {
      headline: "Updates from {{Market Name}}",
      subheadline: "Use approved templates to create ready-to-use local content.",
      cta: "Create local posts",
    },
    ["headline", "subheadline", "cta"]
  );

  assert.deepEqual(Object.keys(issues), ["headline"]);
  assert.match(
    formatGeneratedCopyQualityIssues(issues).join("\n"),
    /unresolved placeholder token/
  );
});

test("generated copy quality allows concise ad fragments and CTAs", () => {
  const issues = generatedCopyQualityIssues(
    {
      headline: "Local content, made on brand",
      subheadline: "Approved templates for every team.",
      proof_note: "Brand stays locked",
      cta: "Start from a template",
    },
    ["headline", "subheadline", "proof_note", "cta"]
  );

  assert.deepEqual(issues, {});
});
