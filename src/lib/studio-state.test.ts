import assert from "node:assert/strict";
import test from "node:test";

import {
  STUDIO_BACKGROUND_CHOICE_FIELD,
  STUDIO_PRODUCT_VARIANT_FIELD,
  generatedContentSizeKey,
  studioDirtyState,
  studioInitialContentsBySize,
  studioInitialSize,
  studioPersistedFieldKeys,
  studioPickerFieldKeys,
  studioPreviewFields,
} from "./studio-state.ts";

const content = {
  id: "content-1",
  structured_fields: { headline: "Saved" },
  outputSize: "square",
  manuallyEdited: false,
};

test("resolves initial Studio content by supported size without duplicate buckets", () => {
  assert.equal(generatedContentSizeKey(content, "portrait", ["square", "portrait"]), "square");
  assert.deepEqual(
    studioInitialContentsBySize(
      [
        content,
        { ...content, id: "newer-but-same-size" },
        { ...content, id: "portrait-content", outputSize: "portrait" },
      ],
      ["square", "portrait"]
    ),
    {
      square: content,
      portrait: { ...content, id: "portrait-content", outputSize: "portrait" },
    }
  );
});

test("falls back to a valid requested, content, or first supported Studio size", () => {
  assert.equal(
    studioInitialSize({
      requestedSize: "portrait",
      contents: [content],
      supportedSizes: ["square", "portrait"],
    }),
    "portrait"
  );
  assert.equal(
    studioInitialSize({
      requestedSize: "story",
      contents: [content],
      supportedSizes: ["square", "portrait"],
    }),
    "square"
  );
  assert.equal(
    studioInitialSize({
      requestedSize: null,
      contents: [],
      supportedSizes: ["landscape"],
    }),
    "landscape"
  );
});

test("builds persisted and picker keys for generic DAM asset choices", () => {
  assert.deepEqual(
    studioPersistedFieldKeys({
      editableFieldKeys: ["headline", "body"],
      assetChoiceFieldKeys: ["hero_asset", STUDIO_PRODUCT_VARIANT_FIELD],
      includeBackgroundChoice: true,
    }),
    ["headline", "body", "hero_asset", STUDIO_PRODUCT_VARIANT_FIELD, STUDIO_BACKGROUND_CHOICE_FIELD]
  );
  assert.deepEqual(
    studioPickerFieldKeys({
      assetChoiceFieldKeys: ["hero_asset", STUDIO_PRODUCT_VARIANT_FIELD],
      includeBackgroundChoice: true,
    }),
    ["hero_asset", STUDIO_PRODUCT_VARIANT_FIELD, STUDIO_BACKGROUND_CHOICE_FIELD]
  );
});

test("treats generic asset-choice changes as picker-only dirty", () => {
  assert.deepEqual(
    studioDirtyState({
      mode: "edit",
      hasContent: true,
      draftFields: { headline: "Saved", hero_asset: "asset-2" },
      savedFields: { headline: "Saved", hero_asset: "asset-1" },
      persistedFieldKeys: ["headline", "hero_asset"],
      editableFieldKeys: ["headline"],
      pickerFieldKeys: ["hero_asset"],
    }),
    { dirty: true, pickerOnlyDirty: true }
  );
  assert.deepEqual(
    studioDirtyState({
      mode: "edit",
      hasContent: true,
      draftFields: { headline: "Changed", hero_asset: "asset-2" },
      savedFields: { headline: "Saved", hero_asset: "asset-1" },
      persistedFieldKeys: ["headline", "hero_asset"],
      editableFieldKeys: ["headline"],
      pickerFieldKeys: ["hero_asset"],
    }),
    { dirty: true, pickerOnlyDirty: false }
  );
});

test("normalizes preview-only legacy product and background fields", () => {
  assert.deepEqual(
    studioPreviewFields({
      draftFields: { headline: "Saved" },
      backgroundKey: "warm",
      productVariantKey: "packshot",
    }),
    {
      headline: "Saved",
      [STUDIO_BACKGROUND_CHOICE_FIELD]: "warm",
      [STUDIO_PRODUCT_VARIANT_FIELD]: "packshot",
    }
  );
});
