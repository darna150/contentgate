import assert from "node:assert/strict";
import test from "node:test";

import {
  TEMPLATE_CONTRACT_VERSION,
  TEMPLATE_LAYOUT_CONTRACTS,
  defaultTemplateSize,
  getTemplateSupportedSizes,
  isTemplateContractReady,
  isTemplateSizeAllowed,
  validateTemplateContract,
  type TemplateDesignProvider,
  type TemplateRuntimeRecord,
} from "./template-contract.ts";
import {
  fitTemplateFields,
  templateFieldIssues,
  type FieldLimits,
} from "./template-fields.ts";

const CATEGORY_BY_LAYOUT: Record<string, string> = {
  apex_canine_social: "social",
  apex_canine_flyer: "flyer",
  caniguard5_social: "social",
  contentgate_local_friendly: "social",
  contentgate_local_premium: "social",
  vitalbite_social: "social",
};

function fixture(
  layoutKey: string,
  provider: TemplateDesignProvider = "canva"
): TemplateRuntimeRecord {
  const contract = TEMPLATE_LAYOUT_CONTRACTS[layoutKey];
  assert.ok(contract, `missing test contract for ${layoutKey}`);
  const fieldLimits: FieldLimits = Object.fromEntries(
    contract.editableFields.map((field) => [
      field,
      { max_chars: 64, max_words: 10, max_lines: 3 },
    ])
  );
  return {
    layoutKey,
    category: CATEGORY_BY_LAYOUT[layoutKey],
    editableFields: [...contract.editableFields],
    fieldLimits,
    lockedFields: [...contract.requiredLockedFields],
    definition: {
      contract_version: TEMPLATE_CONTRACT_VERSION,
      engine: contract.engine,
      renderer: "html",
      sizes: [...contract.sizes],
      layout_policy: contract.layoutPolicy,
      layout_presets: [...contract.layoutPresets],
      overflow_policy: contract.overflowPolicy,
      design_source: {
        provider,
        ...(provider === "figma"
          ? {
              file_key: "figma-file-key",
              page_id: "template-page",
              frame_ids: Object.fromEntries(
                contract.sizes.map((size) => [size, `${layoutKey}-${size}`])
              ),
            }
          : {}),
      },
    },
    status: "active",
  };
}

test("registers every active Phase 4 layout with an explicit output contract", () => {
  assert.deepEqual(Object.keys(TEMPLATE_LAYOUT_CONTRACTS).sort(), [
    "apex_canine_flyer",
    "apex_canine_social",
    "caniguard5_social",
    "contentgate_local_friendly",
    "contentgate_local_premium",
    "vitalbite_social",
  ]);

  for (const layoutKey of Object.keys(TEMPLATE_LAYOUT_CONTRACTS)) {
    const template = fixture(layoutKey);
    assert.deepEqual(validateTemplateContract(template), []);
    assert.equal(isTemplateContractReady(template), true);
  }
});

test("uses the registry for size selection and rejects undeclared outputs", () => {
  for (const [layoutKey, contract] of Object.entries(TEMPLATE_LAYOUT_CONTRACTS)) {
    const template = fixture(layoutKey);
    const input = {
      layoutKey,
      category: template.category,
      definition: template.definition,
    };
    assert.deepEqual(getTemplateSupportedSizes(input), contract.sizes);
    assert.equal(defaultTemplateSize(input), contract.sizes[0]);
    for (const size of contract.sizes) {
      assert.equal(isTemplateSizeAllowed(input, size), true);
    }
    for (const size of [
      "square",
      "portrait",
      "story",
      "feed",
      "link_ad",
      "leaderboard",
      "medium_rectangle",
      "a4",
    ] as const) {
      assert.equal(
        isTemplateSizeAllowed(input, size),
        contract.sizes.includes(size)
      );
    }
  }
});

test("preserves declared sizes for inactive pre-contract templates", () => {
  const input = {
    layoutKey: "caniguard5_social",
    category: "social",
    status: "inactive",
    definition: { sizes: ["square", "story", "feed"] },
  };
  assert.deepEqual(getTemplateSupportedSizes(input), ["square", "story", "feed"]);
  assert.equal(isTemplateSizeAllowed(input, "feed"), true);
});

test("blocks active templates whose fields, locks, sizes, or engine drift", () => {
  const template = fixture("apex_canine_social");
  const invalid: TemplateRuntimeRecord = {
    ...template,
    editableFields: ["headline"],
    lockedFields: template.lockedFields.filter((field) => field !== "logo"),
    definition: {
      ...(template.definition as Record<string, unknown>),
      engine: "unknown-engine",
      sizes: ["feed"],
    },
  };
  const codes = validateTemplateContract(invalid).map((issue) => issue.code);
  assert.equal(codes.includes("editable_fields"), true);
  assert.equal(codes.includes("locked_field"), true);
  assert.equal(codes.includes("engine"), true);
  assert.equal(codes.includes("sizes"), true);
  assert.equal(isTemplateContractReady(invalid), false);
});

test("accepts Figma as a design source without changing runtime behavior", () => {
  for (const layoutKey of Object.keys(TEMPLATE_LAYOUT_CONTRACTS)) {
    const canva = fixture(layoutKey, "canva");
    const figma = fixture(layoutKey, "figma");
    assert.equal(isTemplateContractReady(figma), true);
    assert.deepEqual(
      getTemplateSupportedSizes({
        layoutKey,
        category: figma.category,
        definition: figma.definition,
      }),
      getTemplateSupportedSizes({
        layoutKey,
        category: canva.category,
        definition: canva.definition,
      })
    );
  }
});

test("fits worst-case generated copy inside every active field contract", () => {
  const stress = Array.from({ length: 80 }, (_, index) => `word${index}`).join(" ");
  for (const layoutKey of Object.keys(TEMPLATE_LAYOUT_CONTRACTS)) {
    const template = fixture(layoutKey);
    const fields = Object.fromEntries(
      template.editableFields.map((field) => [field, `${stress}\n${stress}\n${stress}\n${stress}`])
    );
    const fitted = fitTemplateFields(
      fields,
      [...template.editableFields],
      template.fieldLimits
    );
    assert.deepEqual(
      templateFieldIssues(
        fitted,
        [...template.editableFields],
        template.fieldLimits
      ),
      {},
      `${layoutKey} did not fit its stress copy`
    );
  }
});

test("template field validation can leave optional fields blank", () => {
  assert.deepEqual(
    templateFieldIssues(
      {
        headline: "Required headline",
        optional_note: "",
      },
      ["headline", "optional_note"],
      {
        headline: { max_chars: 40 },
        optional_note: { max_chars: 40 },
      },
      ["headline"]
    ),
    {}
  );

  assert.deepEqual(
    templateFieldIssues(
      {
        headline: "",
        optional_note: "",
      },
      ["headline", "optional_note"],
      {
        headline: { max_chars: 40 },
        optional_note: { max_chars: 40 },
      },
      ["headline"]
    ),
    {
      headline: [{ type: "required", message: "Required field" }],
    }
  );
});
