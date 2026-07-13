type KnowledgeSessionReference = {
  id: string;
  productId: string;
};

export function resolveInitialKnowledgeSelection(input: {
  productIds: readonly string[];
  sessions: readonly KnowledgeSessionReference[];
  requestedProductId: string | null;
}) {
  const requestedProductIsAvailable =
    input.requestedProductId !== null &&
    input.productIds.includes(input.requestedProductId);
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
      input.productIds[0] ??
      null,
  };
}
