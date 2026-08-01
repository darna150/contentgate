import assert from "node:assert/strict";
import test from "node:test";

import type { WorkspaceBlueprint } from "./blueprint.ts";
import {
  provisionWorkspace,
  type OnboardingCoreReport,
  type OnboardingRepository,
} from "./engine.ts";
import type { PreparedWorkspacePackage } from "./package.ts";

const blueprint: WorkspaceBlueprint = {
  schemaVersion: "contentgate-workspace-v1",
  workspace: { key: "acme-health", name: "Acme Health" },
  users: [{ key: "owner", email: "owner@acme.test", role: "admin" }],
  products: [{ key: "air", name: "Nimbus Air" }],
  assets: [{ key: "logo", type: "logo", file: "logo.png" }],
};

const preparedPackage: PreparedWorkspacePackage = {
  root: "/package",
  blueprint,
  blueprintSha256: "a".repeat(64),
  documents: [],
  assets: [{
    key: "logo",
    data: new Uint8Array([1, 2, 3]),
    originalFileName: "logo.png",
    mimeType: "image/png",
    fileSizeBytes: 3,
    widthPixels: 10,
    heightPixels: 10,
  }],
  templateBundles: [],
};

const core: OnboardingCoreReport = {
  organizationId: "org-1",
  products: { air: "product-1" },
  campaigns: {},
  documents: {},
  claims: {},
  assets: { logo: "asset-1" },
};

function fakeRepository(options: { failApply?: boolean; completed?: boolean } = {}) {
  const events: string[] = [];
  const repository: OnboardingRepository = {
    async beginRun() {
      events.push("begin");
      return { runId: "run-1", organizationId: "org-1", status: options.completed ? "completed" : "provisioning", resumed: Boolean(options.completed) };
    },
    async getCompletedReceipt() { events.push("receipt"); return core; },
    async provisionUser() { events.push("user"); return { userId: "user-1", createdByRun: true }; },
    async recordStep(input) { events.push(`step:${input.step}:${input.status}`); },
    async upload(input) { events.push(`upload:${input.bucket}`); },
    async removeUploads() { events.push("remove-uploads"); },
    async applyCore() {
      events.push("apply");
      if (options.failApply) throw new Error("database unavailable");
      return core;
    },
    async installTemplateBundle() { throw new Error("not expected"); },
    async completeRun() { events.push("complete"); },
    async markFailed() { events.push("mark-failed"); },
    async rollbackTenantData() { events.push("rollback"); },
    async deleteUser() { events.push("delete-user"); },
    async sendSetupEmail() { events.push("setup-email"); },
  };
  return { repository, events };
}

test("provisions users, staged uploads, core data, completion, and setup email in order", async () => {
  const fake = fakeRepository();
  const receipt = await provisionWorkspace({
    environment: "staging",
    package: preparedPackage,
    repository: fake.repository,
  });
  assert.equal(receipt.status, "completed");
  assert.deepEqual(fake.events, [
    "begin",
    "user",
    "step:user:owner:completed",
    "upload:product-assets",
    "step:uploads:completed",
    "apply",
    "complete",
    "setup-email",
  ]);
});

test("a completed identical package is a read-only resume", async () => {
  const fake = fakeRepository({ completed: true });
  const receipt = await provisionWorkspace({
    environment: "staging",
    package: preparedPackage,
    repository: fake.repository,
  });
  assert.equal(receipt.resumed, true);
  assert.deepEqual(fake.events, ["begin", "receipt"]);
});

test("failure compensates tenant rows, storage, Auth, then removes the empty workspace", async () => {
  const fake = fakeRepository({ failApply: true });
  await assert.rejects(
    provisionWorkspace({
      environment: "staging",
      package: preparedPackage,
      repository: fake.repository,
    }),
    /Onboarding failed at core_data: database unavailable/,
  );
  assert.deepEqual(fake.events, [
    "begin",
    "user",
    "step:user:owner:completed",
    "upload:product-assets",
    "step:uploads:completed",
    "apply",
    "mark-failed",
    "rollback",
    "remove-uploads",
    "delete-user",
    "rollback",
  ]);
});

test("an upload failure removes the provisioned Auth user and empty workspace", async () => {
  const fake = fakeRepository();
  fake.repository.upload = async () => {
    fake.events.push("upload:failed");
    throw new Error("storage unavailable");
  };
  await assert.rejects(
    provisionWorkspace({
      environment: "staging",
      package: preparedPackage,
      repository: fake.repository,
    }),
    /Onboarding failed at uploads: storage unavailable/,
  );
  assert.deepEqual(fake.events.slice(-5), [
    "mark-failed",
    "rollback",
    "remove-uploads",
    "delete-user",
    "rollback",
  ]);
});

test("a template failure compensates core rows and every staged object", async () => {
  const fake = fakeRepository();
  fake.repository.installTemplateBundle = async () => {
    fake.events.push("template:failed");
    throw new Error("template transaction failed");
  };
  const packageWithTemplate: PreparedWorkspacePackage = {
    ...preparedPackage,
    templateBundles: [
      {
        key: "launch",
        assignToProducts: ["air"],
        bundle: null as never,
      },
    ],
  };
  await assert.rejects(
    provisionWorkspace({
      environment: "staging",
      package: packageWithTemplate,
      repository: fake.repository,
    }),
    /Onboarding failed at template:launch: template transaction failed/,
  );
  assert.deepEqual(fake.events.slice(-6), [
    "template:failed",
    "mark-failed",
    "rollback",
    "remove-uploads",
    "delete-user",
    "rollback",
  ]);
});
