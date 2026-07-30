import "server-only";

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

import { createAdminClient } from "../supabase/admin";
import { readWorkspaceArchive } from "./archive";

const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;

function isInside(parent: string, child: string) {
  const prefix = parent.endsWith(sep) ? parent : `${parent}${sep}`;
  return child === parent || child.startsWith(prefix);
}

export async function withStagedWorkspacePackage<T>(
  storagePath: string,
  callback: (packageDirectory: string) => Promise<T>,
) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("onboarding-packages").download(storagePath);
  if (error || !data) throw new Error(`Could not download the staged package: ${error?.message ?? "not found"}`);
  if (data.size > MAX_ARCHIVE_BYTES) throw new Error("Workspace packages must be 50 MB or smaller.");

  const { entries, packagePrefix } = readWorkspaceArchive(
    new Uint8Array(await data.arrayBuffer()),
  );
  const extractionRoot = await mkdtemp(join(tmpdir(), "contentgate-onboarding-"));
  try {
    for (const [name, bytes] of entries) {
      if (!name.startsWith(packagePrefix)) continue;
      const relative = name.slice(packagePrefix.length);
      if (!relative) continue;
      const destination = resolve(extractionRoot, relative);
      if (!isInside(extractionRoot, destination)) throw new Error(`Unsafe archive destination: ${name}`);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, bytes);
    }
    return await callback(extractionRoot);
  } finally {
    await rm(extractionRoot, { recursive: true, force: true });
  }
}
