import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

function runScript(script, args) {
  return spawnSync(process.execPath, ["--import", "tsx", script, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "test" },
  });
}

test("disposable onboarding package builds and passes the Node CLI preflight", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "contentgate-onboarding-tooling-"));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const packageDirectory = join(root, "package");
  const workspaceKey = "qa-onboarding-20990101-tooling";

  const build = runScript("scripts/build-disposable-onboarding-package.ts", [
    "--output",
    packageDirectory,
    "--workspace-key",
    workspaceKey,
    "--admin-email",
    "hol+cg-onboarding-admin-20990101@justdebbie.ing",
    "--member-email",
    "hol+cg-onboarding-member-20990101@justdebbie.ing",
  ]);
  assert.equal(build.status, 0, build.stderr || build.stdout);

  const blueprint = JSON.parse(
    await readFile(join(packageDirectory, "blueprint.json"), "utf8"),
  );
  assert.equal(blueprint.workspace.key, workspaceKey);
  assert.equal(blueprint.assets[0].file, "assets/atlas-qa-brewer.png");

  const preflight = runScript("scripts/onboarding.ts", [
    "preflight",
    packageDirectory,
  ]);
  assert.equal(preflight.status, 0, preflight.stderr || preflight.stdout);
  const report = JSON.parse(preflight.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.workspaceKey, workspaceKey);
  assert.equal(report.counts.templateBundles, 1);

  const repositoryImport = spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      'await import("./src/lib/onboarding/supabase-repository.ts")',
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(
    repositoryImport.status,
    0,
    repositoryImport.stderr || repositoryImport.stdout,
  );
});
