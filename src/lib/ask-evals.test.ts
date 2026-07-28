import assert from "node:assert/strict";
import test from "node:test";

import { ASK_EVAL_CASES, validateAskEvalCases } from "./ask-evals.ts";

test("Ask eval suite defines valid, diverse, source-bound acceptance cases", () => {
  assert.equal(validateAskEvalCases(ASK_EVAL_CASES), true);
  assert.ok(ASK_EVAL_CASES.length >= 10);
  assert.equal(new Set(ASK_EVAL_CASES.map((testCase) => testCase.category)).size, 10);
});

test("Ask eval suite rejects malformed or contradictory cases", () => {
  assert.equal(
    validateAskEvalCases([
      {
        ...ASK_EVAL_CASES[0],
        id: "invalid case",
      },
    ]),
    false
  );
  assert.equal(
    validateAskEvalCases([
      {
        ...ASK_EVAL_CASES[0],
        expectedBehavior: "not_found",
      },
    ]),
    false
  );
});
