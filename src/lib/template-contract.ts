import type { FieldLimits } from "./template-fields";

export const TEMPLATE_CONTRACT_VERSION = 1 as const;

export const TEMPLATE_OUTPUT_SIZES = {
  square: { label: "Square", w: 1080, h: 1080 },
  story: { label: "Story", w: 1080, h: 1920 },
  feed: { label: "Feed", w: 1200, h: 630 },
  a4: { label: "A4 Flyer", w: 1240, h: 1754 },
} as const;

export type TemplateSizeKey = keyof typeof TEMPLATE_OUTPUT_SIZES;
export type TemplateDesignProvider = "canva" | "figma" | "legacy";

export type TemplateDefinition = {
  contract_version?: number;
  engine?: string;
  renderer?: string;
  sizes?: unknown;
  layout_policy?: string;
  layout_presets?: unknown;
  overflow_policy?: string;
  design_source?: {
    provider?: string;
    file_key?: string;
    page_id?: string;
    frame_ids?: Partial<Record<TemplateSizeKey, string>>;
    version?: string;
  };
  [key: string]: unknown;
};

export type TemplateRuntimeRecord = {
  layoutKey: string;
  category: string;
  editableFields: readonly string[];
  fieldLimits: FieldLimits;
  lockedFields: readonly string[];
  definition?: unknown;
  status?: string;
};

export type TemplateContractIssue = {
  code:
    | "unknown_layout"
    | "contract_version"
    | "engine"
    | "sizes"
    | "editable_fields"
    | "field_limit"
    | "locked_field"
    | "layout_policy"
    | "layout_presets"
    | "overflow_policy"
    | "design_source";
  severity: "error" | "warning";
  message: string;
};

export type TemplateLayoutContract = {
  layoutKey: string;
  engine: "react-image-v1";
  renderer: "apex-canine" | "caniguard5" | "vitalbite";
  sizes: readonly TemplateSizeKey[];
  editableFields: readonly string[];
  requiredLockedFields: readonly string[];
  layoutPolicy: "locked_adaptive_presets";
  layoutPresets: readonly ["short", "standard", "long"];
  overflowPolicy: "block_save_review_and_export";
  liveCanvas: true;
};

const ADAPTIVE_PRESETS = ["short", "standard", "long"] as const;

export const TEMPLATE_LAYOUT_CONTRACTS: Record<string, TemplateLayoutContract> = {
  apex_canine_social: {
    layoutKey: "apex_canine_social",
    engine: "react-image-v1",
    renderer: "apex-canine",
    sizes: ["square", "story"],
    editableFields: ["kicker", "headline", "supportCopy", "cta"],
    requiredLockedFields: [
      "logo",
      "product_packaging",
      "dog_image",
      "background",
      "layout",
      "typography",
      "colors",
      "icons",
      "benefit_strip",
    ],
    layoutPolicy: "locked_adaptive_presets",
    layoutPresets: ADAPTIVE_PRESETS,
    overflowPolicy: "block_save_review_and_export",
    liveCanvas: true,
  },
  apex_canine_flyer: {
    layoutKey: "apex_canine_flyer",
    engine: "react-image-v1",
    renderer: "apex-canine",
    sizes: ["a4"],
    editableFields: ["kicker", "headline", "body"],
    requiredLockedFields: [
      "logo",
      "product_packaging",
      "dog_image",
      "background",
      "layout",
      "typography",
      "colors",
      "icons",
      "benefits",
      "cta",
      "disclaimer",
    ],
    layoutPolicy: "locked_adaptive_presets",
    layoutPresets: ADAPTIVE_PRESETS,
    overflowPolicy: "block_save_review_and_export",
    liveCanvas: true,
  },
  caniguard5_social: {
    layoutKey: "caniguard5_social",
    engine: "react-image-v1",
    renderer: "caniguard5",
    sizes: ["square"],
    editableFields: ["headline", "supportCopy"],
    requiredLockedFields: [
      "logo",
      "tagline",
      "dog_image",
      "product_packaging",
      "disease_icons",
      "cta_button",
      "background",
      "layout",
      "typography",
      "colors",
    ],
    layoutPolicy: "locked_adaptive_presets",
    layoutPresets: ADAPTIVE_PRESETS,
    overflowPolicy: "block_save_review_and_export",
    liveCanvas: true,
  },
  vitalbite_social: {
    layoutKey: "vitalbite_social",
    engine: "react-image-v1",
    renderer: "vitalbite",
    sizes: ["square"],
    editableFields: ["kicker", "headline", "supporting", "cta"],
    requiredLockedFields: [
      "logo",
      "dog_image",
      "product_jar",
      "benefit_icons",
      "background",
      "layout",
      "typography",
      "colors",
    ],
    layoutPolicy: "locked_adaptive_presets",
    layoutPresets: ADAPTIVE_PRESETS,
    overflowPolicy: "block_save_review_and_export",
    liveCanvas: true,
  },
};

const CATEGORY_SIZES: Record<string, readonly TemplateSizeKey[]> = {
  social: ["square", "story", "feed"],
  flyer: ["a4"],
  one_pager: ["a4"],
  presentation: ["feed"],
};

function asDefinition(value: unknown): TemplateDefinition {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as TemplateDefinition)
    : {};
}

function asSizeKeys(value: unknown): TemplateSizeKey[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (size): size is TemplateSizeKey =>
      typeof size === "string" && size in TEMPLATE_OUTPUT_SIZES
  );
}

function sameOrderedValues(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function getTemplateLayoutContract(
  layoutKey: string
): TemplateLayoutContract | null {
  return TEMPLATE_LAYOUT_CONTRACTS[layoutKey] ?? null;
}

export function usesRegisteredTemplateContract(input: {
  layoutKey: string;
  definition?: unknown;
  status?: string;
}): boolean {
  if (!getTemplateLayoutContract(input.layoutKey)) return false;
  const definition = asDefinition(input.definition);
  return input.status !== "inactive" || definition.contract_version === TEMPLATE_CONTRACT_VERSION;
}

export function getTemplateSupportedSizes(input: {
  layoutKey: string;
  category: string;
  definition?: unknown;
  status?: string;
}): TemplateSizeKey[] {
  const contract = getTemplateLayoutContract(input.layoutKey);
  if (contract && usesRegisteredTemplateContract(input)) return [...contract.sizes];

  const declared = asSizeKeys(asDefinition(input.definition).sizes);
  if (declared.length > 0) return declared;
  return [...(CATEGORY_SIZES[input.category] ?? ["square"] as const)];
}

export function defaultTemplateSize(input: {
  layoutKey: string;
  category: string;
  definition?: unknown;
  status?: string;
}): TemplateSizeKey {
  return getTemplateSupportedSizes(input)[0] ?? "square";
}

export function isTemplateSizeAllowed(
  input: { layoutKey: string; category: string; definition?: unknown; status?: string },
  size: string
): size is TemplateSizeKey {
  return getTemplateSupportedSizes(input).includes(size as TemplateSizeKey);
}

export function validateTemplateContract(
  template: TemplateRuntimeRecord
): TemplateContractIssue[] {
  const contract = getTemplateLayoutContract(template.layoutKey);
  if (!contract) {
    return template.status === "active"
      ? [{
          code: "unknown_layout",
          severity: "error",
          message: `Active layout ${template.layoutKey} is not registered.`,
        }]
      : [];
  }

  const definition = asDefinition(template.definition);
  const issues: TemplateContractIssue[] = [];
  if (definition.contract_version == null) {
    issues.push({
      code: "contract_version",
      severity: "warning",
      message: "Template definition has not been stamped with a contract version.",
    });
  } else if (definition.contract_version !== TEMPLATE_CONTRACT_VERSION) {
    issues.push({
      code: "contract_version",
      severity: "error",
      message: `Unsupported template contract version ${definition.contract_version}.`,
    });
  }

  if (definition.engine == null) {
    issues.push({
      code: "engine",
      severity: "warning",
      message: "Template definition has no engine identifier.",
    });
  } else if (definition.engine !== contract.engine) {
    issues.push({
      code: "engine",
      severity: "error",
      message: `Template engine must be ${contract.engine}.`,
    });
  }

  const declaredSizes = asSizeKeys(definition.sizes);
  if (!sameOrderedValues(declaredSizes, contract.sizes)) {
    issues.push({
      code: "sizes",
      severity: "error",
      message: `Supported sizes must be ${contract.sizes.join(", ")}.`,
    });
  }
  if (!sameOrderedValues(template.editableFields, contract.editableFields)) {
    issues.push({
      code: "editable_fields",
      severity: "error",
      message: `Editable fields must be ${contract.editableFields.join(", ")}.`,
    });
  }
  for (const field of contract.editableFields) {
    const limit = template.fieldLimits[field];
    if (!limit?.max_chars || !limit.max_lines) {
      issues.push({
        code: "field_limit",
        severity: "error",
        message: `${field} requires positive max_chars and max_lines limits.`,
      });
    }
  }
  for (const field of contract.requiredLockedFields) {
    if (!template.lockedFields.includes(field)) {
      issues.push({
        code: "locked_field",
        severity: "error",
        message: `${field} must remain locked.`,
      });
    }
  }
  if (definition.layout_policy !== contract.layoutPolicy) {
    issues.push({
      code: "layout_policy",
      severity: "error",
      message: `Layout policy must be ${contract.layoutPolicy}.`,
    });
  }
  const presets = Array.isArray(definition.layout_presets)
    ? definition.layout_presets.filter((value): value is string => typeof value === "string")
    : [];
  if (!sameOrderedValues(presets, contract.layoutPresets)) {
    issues.push({
      code: "layout_presets",
      severity: "error",
      message: `Layout presets must be ${contract.layoutPresets.join(", ")}.`,
    });
  }
  if (definition.overflow_policy !== contract.overflowPolicy) {
    issues.push({
      code: "overflow_policy",
      severity: "error",
      message: `Overflow policy must be ${contract.overflowPolicy}.`,
    });
  }

  const provider = definition.design_source?.provider;
  if (provider == null) {
    issues.push({
      code: "design_source",
      severity: "warning",
      message: "Template definition has no normalized design source.",
    });
  } else if (!(["canva", "figma", "legacy"] as const).includes(provider as TemplateDesignProvider)) {
    issues.push({
      code: "design_source",
      severity: "error",
      message: `Unsupported design source provider ${provider}.`,
    });
  }

  return issues;
}

export function isTemplateContractReady(template: TemplateRuntimeRecord): boolean {
  return !validateTemplateContract(template).some((issue) => issue.severity === "error");
}
