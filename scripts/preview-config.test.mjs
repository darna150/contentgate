import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("the checked-in preview starts from the active checkout", async () => {
  const launch = JSON.parse(await readFile(new URL("../.claude/launch.json", import.meta.url), "utf8"));

  assert.equal(launch.version, "0.0.1");
  assert.ok(Array.isArray(launch.configurations));
  assert.equal(launch.configurations.length, 1);

  const [configuration] = launch.configurations;
  assert.equal(configuration.runtimeExecutable, "npm");
  assert.deepEqual(configuration.runtimeArgs, ["run", "dev"]);
  assert.equal(
    configuration.cwd,
    undefined,
    "Do not commit a checkout-specific cwd; Preview must use the folder opened for the current session.",
  );
});

test("the enterprise health cron is configured for the five-minute Pro interval", async () => {
  const configuration = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  const healthCron = configuration.crons?.find(
    (cron) => cron.path === "/api/cron/asset-health",
  );

  assert.deepEqual(healthCron, {
    path: "/api/cron/asset-health",
    schedule: "*/5 * * * *",
  });
});
