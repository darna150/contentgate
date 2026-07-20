type KnowledgeSessionReference = {
  id: string;
  productId: string | null;
};

export function resolveInitialKnowledgeSelection(input: {
  notebookIds: readonly string[];
  sessions: readonly KnowledgeSessionReference[];
  requestedProductId: string | null;
  workspaceNotebookId: string;
}) {
  const requestedProductIsAvailable =
    input.requestedProductId !== null &&
    input.notebookIds.includes(input.requestedProductId);
  const requestedProductId = requestedProductIsAvailable
    ? input.requestedProductId
    : null;
  const initialSession = requestedProductId
    ? input.sessions.find((session) => session.productId === requestedProductId) ?? null
    : input.sessions[0] ?? null;

  return {
    activeSessionId: initialSession?.id ?? null,
    selectedProductId:
      requestedProductId ??
      initialSession?.productId ??
      input.workspaceNotebookId,
  };
}
