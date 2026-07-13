import assert from "node:assert/strict";
import test from "node:test";
import {
  canEditContent,
  canExportContent,
  canReviewContent,
  canSubmitContent,
  isContentExportFormat,
} from "./content-governance.ts";

const authorId = "author";

test("authors and admins can submit draft or rejected content", () => {
  assert.equal(
    canSubmitContent({
      role: "member",
      userId: authorId,
      authorId,
      status: "draft",
    }),
    true
  );
  assert.equal(
    canSubmitContent({
      role: "member",
      userId: "other-member",
      authorId,
      status: "draft",
    }),
    false
  );
  assert.equal(
    canSubmitContent({
      role: "approver",
      userId: "reviewer",
      authorId,
      status: "rejected",
    }),
    false
  );
  assert.equal(
    canSubmitContent({
      role: "admin",
      userId: "admin",
      authorId,
      status: "rejected",
    }),
    true
  );
  assert.equal(
    canSubmitContent({
      role: "admin",
      userId: "admin",
      authorId,
      status: "in_review",
    }),
    false
  );
});

test("only approvers and admins can review", () => {
  assert.equal(canReviewContent("member"), false);
  assert.equal(canReviewContent("approver"), true);
  assert.equal(canReviewContent("admin"), true);
});

test("only the author can edit editable lifecycle states", () => {
  assert.equal(
    canEditContent({ userId: authorId, authorId, status: "approved" }),
    true
  );
  assert.equal(
    canEditContent({ userId: "reviewer", authorId, status: "draft" }),
    false
  );
  assert.equal(
    canEditContent({ userId: authorId, authorId, status: "in_review" }),
    false
  );
});

test("export requires the exact currently approved revision", () => {
  assert.equal(
    canExportContent({
      status: "approved",
      currentRevision: 3,
      approvedRevision: 3,
    }),
    true
  );
  assert.equal(
    canExportContent({
      status: "approved",
      currentRevision: 4,
      approvedRevision: 3,
    }),
    false
  );
  assert.equal(
    canExportContent({
      status: "draft",
      currentRevision: 4,
      approvedRevision: null,
    }),
    false
  );
});

test("export formats are a closed allowlist", () => {
  for (const format of ["md", "clipboard_text", "png", "jpeg", "pdf"]) {
    assert.equal(isContentExportFormat(format), true);
  }
  assert.equal(isContentExportFormat("svg"), false);
  assert.equal(isContentExportFormat(null), false);
});
