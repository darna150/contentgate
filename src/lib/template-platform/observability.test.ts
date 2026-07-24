import assert from "node:assert/strict";
import test from "node:test";

import { templatePipelineDuration } from "./observability.ts";

test("template pipeline duration is non-negative", () => {
  assert.equal(templatePipelineDuration(Date.now() + 10_000), 0);
});
