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
      productIds: ["product-a", "product-b"],
      sessions,
      requestedProductId: "product-b",
    }),
    { activeSessionId: "session-b", selectedProductId: "product-b" }
  );
});

test("keeps requested product context when it has no session", () => {
  assert.deepEqual(
    resolveInitialKnowledgeSelection({
      productIds: ["product-a", "product-c"],
      sessions,
      requestedProductId: "product-c",
    }),
    { activeSessionId: null, selectedProductId: "product-c" }
  );
});

test("ignores an unavailable requested product", () => {
  assert.deepEqual(
    resolveInitialKnowledgeSelection({
      productIds: ["product-a", "product-b"],
      sessions,
      requestedProductId: "outside-org-product",
    }),
    { activeSessionId: "session-a", selectedProductId: "product-a" }
  );
});
