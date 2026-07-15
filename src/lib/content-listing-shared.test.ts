import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cursorFromOffset,
  flattenContentRow,
  offsetFromCursor,
  type ContentListRow,
} from "./content-listing-shared.ts";

function baseRow(overrides: Partial<ContentListRow> = {}): ContentListRow {
  return {
    id: "content-1",
    title: "Draft headline",
    status: "draft",
    target_language: "English",
    audience: "Local teams",
    created_at: "2026-07-15T00:00:00.000Z",
    updated_at: "2026-07-15T00:10:00.000Z",
    products: { name: "ContentGate" },
    templates: null,
    product_templates: null,
    template_versions: null,
    template_variants: null,
    creator: { full_name: "Debbie Melgarejo" },
    ...overrides,
  };
}

test("flattenContentRow prefers legacy product template labels when present", () => {
  const row = flattenContentRow(
    baseRow({
      product_templates: { variant: "Legacy Social" },
      template_versions: {
        version_label: "v1",
        template_families: { name: "Platform Family" },
      },
      template_variants: { label: "Square", variant_key: "square" },
    })
  );

  assert.equal(row.productName, "ContentGate");
  assert.equal(row.templateName, "Legacy Social");
  assert.equal(row.creatorName, "Debbie Melgarejo");
});

test("flattenContentRow builds platform family and size labels", () => {
  const row = flattenContentRow(
    baseRow({
      template_versions: {
        version_label: "figwright-v1",
        template_families: { name: "ContentGate Local Friendly" },
      },
      template_variants: { label: "Link Ad", variant_key: "link_ad" },
    })
  );

  assert.equal(row.templateName, "ContentGate Local Friendly · Link Ad");
  assert.equal(row.sizeKey, "link_ad");
});

test("flattenContentRow falls back to legacy template name when platform metadata is absent", () => {
  const row = flattenContentRow(
    baseRow({
      products: [{ name: "ContentGate" }],
      templates: { name: "Old Template" },
      creator: null,
    })
  );

  assert.equal(row.templateName, "Old Template");
  assert.equal(row.creatorName, null);
});

test("offset cursor helpers clamp invalid cursor input", () => {
  assert.equal(offsetFromCursor(null), 0);
  assert.equal(offsetFromCursor("-10"), 0);
  assert.equal(offsetFromCursor("not-a-number"), 0);
  assert.equal(offsetFromCursor("25"), 25);
  assert.equal(cursorFromOffset(-20), "0");
  assert.equal(cursorFromOffset(75), "75");
});
