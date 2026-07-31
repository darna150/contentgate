function fixtureValue(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback;
}

export const clientFixture = {
  productId: fixtureValue("CONTENTGATE_E2E_PRODUCT_ID", "__missing_product_id__"),
  productName: fixtureValue("CONTENTGATE_E2E_PRODUCT_NAME", "__missing_product_name__"),
  assignmentId: fixtureValue("CONTENTGATE_E2E_ASSIGNMENT_ID", "__missing_assignment_id__"),
  contentId: fixtureValue("CONTENTGATE_E2E_CONTENT_ID", "__missing_content_id__"),
  documentId: fixtureValue("CONTENTGATE_E2E_DOCUMENT_ID", "__missing_document_id__"),
  templateName: fixtureValue("CONTENTGATE_E2E_TEMPLATE_NAME", "__missing_template_name__"),
  outputSizeKey: fixtureValue("CONTENTGATE_E2E_OUTPUT_SIZE_KEY", "__missing_output_size_key__"),
  outputSizeLabel: fixtureValue("CONTENTGATE_E2E_OUTPUT_SIZE_LABEL", "__missing_output_size_label__"),
  outputWidth: Number.parseInt(process.env.CONTENTGATE_E2E_OUTPUT_WIDTH ?? "", 10),
  outputHeight: Number.parseInt(process.env.CONTENTGATE_E2E_OUTPUT_HEIGHT ?? "", 10),
  knowledgeQuestion: fixtureValue("CONTENTGATE_E2E_KNOWLEDGE_QUESTION", "__missing_knowledge_question__"),
};

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function requireClientFixture(
  fields: Array<keyof typeof clientFixture>,
) {
  const missing = fields.filter((field) => {
    const value = clientFixture[field];
    return typeof value === "number" ? !Number.isInteger(value) || value <= 0 : value.startsWith("__missing_");
  });
  if (missing.length > 0) {
    throw new Error(
      `Missing client-neutral E2E configuration: ${missing.map((field) => `CONTENTGATE_E2E_${field.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`).join(", ")}`,
    );
  }
}
