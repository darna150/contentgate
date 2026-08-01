import assert from "node:assert/strict";
import test from "node:test";

import { strToU8, zipSync } from "fflate";

import { readWorkspaceArchive } from "./archive.ts";

test("locates a workspace package inside one optional archive folder", () => {
  const archive = zipSync({
    "client/blueprint.json": strToU8("{}"),
    "client/assets/logo.png": new Uint8Array([1, 2, 3]),
  });
  const result = readWorkspaceArchive(archive);
  assert.equal(result.packagePrefix, "client/");
  assert.equal(result.entries.length, 2);
});

test("rejects archive traversal paths", () => {
  const archive = zipSync({
    "blueprint.json": strToU8("{}"),
    "../outside.txt": strToU8("no"),
  });
  assert.throws(() => readWorkspaceArchive(archive), /Unsafe archive path/);
});

test("rejects ambiguous packages with multiple blueprints", () => {
  const archive = zipSync({
    "first/blueprint.json": strToU8("{}"),
    "second/blueprint.json": strToU8("{}"),
  });
  assert.throws(() => readWorkspaceArchive(archive), /exactly one blueprint/);
});

test("rejects an oversized advertised expansion before decompression", () => {
  const archive = zipSync({ "blueprint.json": strToU8("{}") });
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  let centralDirectory = -1;
  for (let index = 0; index <= archive.length - 4; index += 1) {
    if (view.getUint32(index, true) === 0x02014b50) {
      centralDirectory = index;
      break;
    }
  }
  assert.notEqual(centralDirectory, -1);
  view.setUint32(centralDirectory + 24, 250 * 1024 * 1024 + 1, true);
  assert.throws(
    () => readWorkspaceArchive(archive),
    /expands beyond the 250 MB safety limit/i,
  );
});
