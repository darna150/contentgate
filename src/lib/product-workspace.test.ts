import assert from "node:assert/strict";
import test from "node:test";

import {
  canGenerateForProduct,
  getWorkspacePermissions,
  getWorkspaceSectionStates,
  isProductLifecycleActive,
} from "./product-workspace.ts";

test("limits workspace administration to admins", () => {
  const admin = getWorkspacePermissions({
    role: "admin",
    productStatus: "active",
    activeTemplateCount: 1,
  });
  const member = getWorkspacePermissions({
    role: "member",
    productStatus: "active",
    activeTemplateCount: 1,
  });

  assert.equal(admin.canEditProduct, true);
  assert.equal(admin.canManageAssets, true);
  assert.equal(admin.canManageKnowledge, true);
  assert.equal(admin.canManageTemplates, true);
  assert.equal(member.canEditProduct, false);
  assert.equal(member.canManageAssets, false);
  assert.equal(member.canManageKnowledge, false);
  assert.equal(member.canManageTemplates, false);
});

test("allows approvers to review without granting product administration", () => {
  const permissions = getWorkspacePermissions({
    role: "approver",
    productStatus: "active",
    activeTemplateCount: 1,
  });

  assert.equal(permissions.canReviewContent, true);
  assert.equal(permissions.canGenerateContent, true);
  assert.equal(permissions.canManageTemplates, false);
});

test("blocks generation and Studio when a product is archived or has no template", () => {
  const archived = getWorkspacePermissions({
    role: "admin",
    productStatus: "archived",
    activeTemplateCount: 1,
  });
  const unconfigured = getWorkspacePermissions({
    role: "admin",
    productStatus: "active",
    activeTemplateCount: 0,
  });
  const inactive = getWorkspacePermissions({
    role: "admin",
    productStatus: "inactive",
    activeTemplateCount: 1,
  });

  assert.equal(canGenerateForProduct("active", 1), true);
  assert.equal(canGenerateForProduct("archived", 1), false);
  assert.equal(isProductLifecycleActive("inactive"), false);
  assert.equal(archived.canGenerateContent, false);
  assert.equal(archived.canOpenStudio, false);
  assert.equal(unconfigured.canGenerateContent, false);
  assert.equal(unconfigured.canOpenStudio, false);
  assert.equal(inactive.canGenerateContent, false);
  assert.equal(inactive.canOpenStudio, false);
});

test("describes section empty states and hides actions a member cannot take", () => {
  const permissions = getWorkspacePermissions({
    role: "member",
    productStatus: "active",
    activeTemplateCount: 0,
  });
  const sections = getWorkspaceSectionStates({
    productId: "product-1",
    permissions,
    counts: {
      assets: 0,
      approvedSources: 0,
      approvedClaims: 0,
      activeTemplates: 0,
      content: 0,
      inReview: 0,
    },
  });

  assert.equal(sections.assets.emptyState, "upload_first_asset");
  assert.equal(sections.assets.actionHref, null);
  assert.equal(sections.knowledge.emptyState, "add_approved_knowledge");
  assert.equal(sections.templates.emptyState, "configure_template");
  assert.equal(sections.content.canAct, false);
  assert.equal(sections.approvals.emptyState, "queue_clear");
});

test("distinguishes missing source and claim knowledge states", () => {
  const permissions = getWorkspacePermissions({
    role: "admin",
    productStatus: "active",
    activeTemplateCount: 1,
  });
  const base = {
    productId: "product-1",
    permissions,
    counts: {
      assets: 1,
      approvedSources: 0,
      approvedClaims: 1,
      activeTemplates: 1,
      content: 2,
      inReview: 1,
    },
  };

  assert.equal(
    getWorkspaceSectionStates(base).knowledge.emptyState,
    "add_approved_source"
  );
  assert.equal(
    getWorkspaceSectionStates({
      ...base,
      counts: { ...base.counts, approvedSources: 1, approvedClaims: 0 },
    }).knowledge.emptyState,
    "add_approved_claim"
  );
});
