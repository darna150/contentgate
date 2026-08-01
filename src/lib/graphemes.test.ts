import assert from "node:assert/strict";
import test from "node:test";

import { graphemeCount, sliceGraphemes, splitGraphemes } from "./graphemes.ts";

test("counts user-visible graphemes instead of UTF-16 code units", () => {
  assert.equal(graphemeCount("A😀B"), 3);
  assert.equal(graphemeCount("e\u0301"), 1);
  assert.equal(graphemeCount("👩‍💻"), 1);
  assert.equal(graphemeCount("🇵🇭"), 1);
});
test("slices without splitting emoji or combining sequences", () => {
  assert.deepEqual(splitGraphemes("A👩‍💻e\u0301B"), ["A", "👩‍💻", "e\u0301", "B"]);
  assert.equal(sliceGraphemes("A👩‍💻e\u0301B", 0, 3), "A👩‍💻e\u0301");
});
