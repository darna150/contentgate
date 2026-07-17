import assert from "node:assert/strict";
import test from "node:test";
import { nextRovingIndex } from "./roving-focus.ts";

test("moves forward on ArrowRight and ArrowDown", () => {
  assert.equal(nextRovingIndex(0, "ArrowRight", 4), 1);
  assert.equal(nextRovingIndex(0, "ArrowDown", 4), 1);
});

test("moves backward on ArrowLeft and ArrowUp", () => {
  assert.equal(nextRovingIndex(2, "ArrowLeft", 4), 1);
  assert.equal(nextRovingIndex(2, "ArrowUp", 4), 1);
});

test("wraps around at both ends", () => {
  assert.equal(nextRovingIndex(3, "ArrowRight", 4), 0);
  assert.equal(nextRovingIndex(0, "ArrowLeft", 4), 3);
});

test("Home and End jump to the first and last index", () => {
  assert.equal(nextRovingIndex(2, "Home", 4), 0);
  assert.equal(nextRovingIndex(2, "End", 4), 3);
});

test("returns null for keys it doesn't handle", () => {
  assert.equal(nextRovingIndex(1, "Enter", 4), null);
  assert.equal(nextRovingIndex(1, "a", 4), null);
});

test("returns null when there are no options to move between", () => {
  assert.equal(nextRovingIndex(0, "ArrowRight", 0), null);
});
