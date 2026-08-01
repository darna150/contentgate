import { posix } from "node:path";

import { unzipSync } from "fflate";

const MAX_UNPACKED_BYTES = 250 * 1024 * 1024;
const MAX_ENTRIES = 5_000;

export type WorkspaceArchive = {
  packagePrefix: string;
  entries: Array<[name: string, bytes: Uint8Array]>;
};

function safeArchiveEntry(name: string) {
  if (!name || name.startsWith("/") || name.includes("\\") || name.includes("\0")) return false;
  const normalized = posix.normalize(name);
  return normalized !== ".." && !normalized.startsWith("../") && normalized === name.replace(/^\.\//, "");
}

export function readWorkspaceArchive(bytes: Uint8Array): WorkspaceArchive {
  let entryCount = 0;
  let advertisedUnpackedBytes = 0;
  const names = new Set<string>();
  const files = unzipSync(bytes, {
    // fflate reads this information from the central directory before it
    // allocates the decompressed entry. Rejecting here prevents a small ZIP
    // bomb from expanding in process memory before the post-unzip checks run.
    filter(file) {
      entryCount += 1;
      if (entryCount > MAX_ENTRIES) {
        throw new Error(`Workspace package must contain no more than ${MAX_ENTRIES} entries.`);
      }
      if (!safeArchiveEntry(file.name)) throw new Error(`Unsafe archive path: ${file.name}`);
      if (names.has(file.name)) throw new Error(`Duplicate archive path: ${file.name}`);
      names.add(file.name);
      advertisedUnpackedBytes += file.originalSize;
      if (advertisedUnpackedBytes > MAX_UNPACKED_BYTES) {
        throw new Error("Workspace package expands beyond the 250 MB safety limit.");
      }
      return !file.name.endsWith("/");
    },
  });
  const entries = Object.entries(files).filter(([name]) => !name.endsWith("/"));
  if (entries.length === 0 || entries.length > MAX_ENTRIES) {
    throw new Error(`Workspace package must contain 1–${MAX_ENTRIES} files.`);
  }
  let unpackedBytes = 0;
  for (const [name, value] of entries) {
    // Defend again against malformed archives whose central-directory sizes do
    // not match the actual decompressor output.
    if (!safeArchiveEntry(name)) throw new Error(`Unsafe archive path: ${name}`);
    unpackedBytes += value.byteLength;
    if (unpackedBytes > MAX_UNPACKED_BYTES) throw new Error("Workspace package expands beyond the 250 MB safety limit.");
  }

  const blueprintEntries = entries.filter(([name]) => name === "blueprint.json" || name.endsWith("/blueprint.json"));
  if (blueprintEntries.length !== 1) throw new Error("The archive must contain exactly one blueprint.json.");
  const blueprintEntry = blueprintEntries[0][0];
  return {
    packagePrefix: blueprintEntry.slice(0, -"blueprint.json".length),
    entries,
  };
}
