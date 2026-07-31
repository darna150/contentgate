import assert from "node:assert/strict";
import test from "node:test";

import { resolveInitialKnowledgeSelection } from "./knowledge-hub.ts";

const sessions = [
  { id: "session-a", productId: "product-a" },
  { id: "session-b", productId: "product-b" },
];

test("opens the newest existing session for a requested product", () => {
  assert.deepEqual(
    resolveInitialKnowledgeSelection({
      notebookIds: ["workspace", "product-a", "product-b"],
      sessions,
      requestedProductId: "product-b",
      workspaceNotebookId: "workspace",
    }),
    { activeSessionId: "session-b", selectedProductId: "product-b" }
  );
});

test("keeps requested product context when it has no session", () => {
  assert.deepEqual(
    resolveInitialKnowledgeSelection({
      notebookIds: ["workspace", "product-a", "product-c"],
      sessions,
      requestedProductId: "product-c",
      workspaceNotebookId: "workspace",
    }),
    { activeSessionId: null, selectedProductId: "product-c" }
  );
});

test("ignores an unavailable requested product", () => {
  assert.deepEqual(
    resolveInitialKnowledgeSelection({
      notebookIds: ["workspace", "product-a", "product-b"],
      sessions,
      requestedProductId: "outside-org-product",
      workspaceNotebookId: "workspace",
    }),
    { activeSessionId: "session-a", selectedProductId: "product-a" }
  );
});

test("falls back to the workspace notebook when no product sessions exist", () => {
  assert.deepEqual(
    resolveInitialKnowledgeSelection({
      notebookIds: ["workspace"],
      sessions: [],
      requestedProductId: null,
      workspaceNotebookId: "workspace",
    }),
    { activeSessionId: null, selectedProductId: "workspace" }
  );
});

test("keeps the workspace notebook selected when it has no session", () => {
  assert.deepEqual(
    resolveInitialKnowledgeSelection({
      notebookIds: ["workspace", "product-a"],
      sessions: [],
      requestedProductId: "workspace",
      workspaceNotebookId: "workspace",
    }),
    { activeSessionId: null, selectedProductId: "workspace" }
  );
});
