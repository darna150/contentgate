export const STUDIO_BACKGROUND_CHOICE_FIELD = "__backgroundChoice";
export const STUDIO_PRODUCT_VARIANT_FIELD = "__productVariantKey";

export type StudioStateContent = {
  id: string;
  structured_fields: Record<string, string>;
  outputSize: string | null;
  manuallyEdited: boolean;
};

export type StudioDirtyState = {
  dirty: boolean;
  pickerOnlyDirty: boolean;
};

export function generatedContentSizeKey(
  content: Pick<StudioStateContent, "outputSize"> | null,
  fallback: string,
  supportedSizes: readonly string[]
) {
  if (content?.outputSize && supportedSizes.includes(content.outputSize)) {
    return content.outputSize;
  }
  return fallback;
}

export function studioInitialContentsBySize<T extends StudioStateContent>(
  contents: readonly T[],
  supportedSizes: readonly string[]
): Partial<Record<string, T>> {
  const entries: Partial<Record<string, T>> = {};
  const fallback = supportedSizes[0] ?? "";
  for (const item of contents) {
    const itemSize = generatedContentSizeKey(item, fallback, supportedSizes);
    if (itemSize && !entries[itemSize]) entries[itemSize] = item;
  }
  return entries;
}

export function studioInitialSize(input: {
  requestedSize: string | null;
  contents: readonly Pick<StudioStateContent, "outputSize">[];
  supportedSizes: readonly string[];
}) {
  if (input.requestedSize && input.supportedSizes.includes(input.requestedSize)) {
    return input.requestedSize;
  }
  const firstContentSize = input.contents[0]?.outputSize;
  if (firstContentSize && input.supportedSizes.includes(firstContentSize)) {
    return firstContentSize;
  }
  return input.supportedSizes[0] ?? "";
}

export function studioFieldsForContent(
  content: Pick<StudioStateContent, "structured_fields"> | null,
  defaultCopy: Record<string, string>
) {
  return content?.structured_fields ?? defaultCopy;
}

export function studioPreviewFields(input: {
  draftFields: Record<string, string>;
  backgroundKey: string;
  productVariantKey: string;
}) {
  return {
    ...input.draftFields,
    [STUDIO_BACKGROUND_CHOICE_FIELD]: input.backgroundKey,
    [STUDIO_PRODUCT_VARIANT_FIELD]: input.productVariantKey,
  };
}

export function studioPersistedFieldKeys(input: {
  editableFieldKeys: readonly string[];
  assetChoiceFieldKeys: readonly string[];
  includeBackgroundChoice: boolean;
}) {
  return Array.from(
    new Set([
      ...input.editableFieldKeys,
      ...input.assetChoiceFieldKeys,
      ...(input.includeBackgroundChoice ? [STUDIO_BACKGROUND_CHOICE_FIELD] : []),
    ])
  );
}

export function studioPickerFieldKeys(input: {
  assetChoiceFieldKeys: readonly string[];
  includeBackgroundChoice: boolean;
}) {
  return Array.from(
    new Set([
      ...input.assetChoiceFieldKeys,
      ...(input.includeBackgroundChoice ? [STUDIO_BACKGROUND_CHOICE_FIELD] : []),
    ])
  );
}

export function studioDirtyState(input: {
  mode: string;
  hasContent: boolean;
  draftFields: Record<string, string>;
  savedFields: Record<string, string>;
  persistedFieldKeys: readonly string[];
  editableFieldKeys: readonly string[];
  pickerFieldKeys: readonly string[];
}): StudioDirtyState {
  const dirty =
    input.mode === "edit" &&
    input.hasContent &&
    input.persistedFieldKeys.some(
      (key) => (input.draftFields[key] ?? "") !== (input.savedFields[key] ?? "")
    );
  if (!dirty) return { dirty: false, pickerOnlyDirty: false };

  const copyFieldsUnchanged = input.editableFieldKeys.every(
    (key) => (input.draftFields[key] ?? "") === (input.savedFields[key] ?? "")
  );
  const pickerFieldsChanged = input.pickerFieldKeys.some(
    (key) => (input.draftFields[key] ?? "") !== (input.savedFields[key] ?? "")
  );
  return {
    dirty,
    pickerOnlyDirty: copyFieldsUnchanged && pickerFieldsChanged,
  };
}
