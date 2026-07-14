export const TEMPLATE_BUNDLE_SCHEMA_VERSION = "template-bundle-v1" as const;

export type TemplateBundleFieldType =
  | "asset_choice"
  | "boolean"
  | "date"
  | "enum"
  | "image"
  | "number"
  | "text";

export type TemplateBundleFieldSource = "ai" | "locked" | "product" | "user";

export type TemplateBundleField = {
  key: string;
  label: string;
  type: TemplateBundleFieldType;
  source: TemplateBundleFieldSource;
  required?: boolean;
  localizable?: boolean;
  evidenceRequired?: boolean;
  options?: readonly string[];
  defaultValue?: unknown;
};

export type TemplateBundleFont = {
  key: string;
  family: string;
  style: "normal" | "italic";
  weight: number;
  asset: string;
  sha256: string;
};

export type TemplateBundleAsset = {
  key: string;
  kind: "background" | "font" | "image" | "reference";
  path: string;
  sha256: string;
  width?: number;
  height?: number;
  mimeType?: string;
};

export type TemplateBundleTextSlot = {
  key: string;
  field: string;
  kind: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  fontKey: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  color: string;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  maxChars?: number;
  maxWords?: number;
  maxLines: number;
  lineChars?: number;
  minFontSize?: number;
  fit: "fixed" | "shrink_to_fit";
};

export type TemplateBundleImageSlot = {
  key: string;
  field: string;
  kind: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  fit: "contain" | "cover";
  focalPoint?: { x: number; y: number };
};

export type TemplateBundleSlot = TemplateBundleTextSlot | TemplateBundleImageSlot;

export type TemplateBundleVariant = {
  key: string;
  label: string;
  channel: "display_ad" | "document" | "email" | "presentation" | "social";
  width: number;
  height: number;
  referenceAsset: string;
  backgroundAsset: string;
  slots: readonly TemplateBundleSlot[];
};

export type TemplateBundleManifest = {
  schemaVersion: typeof TEMPLATE_BUNDLE_SCHEMA_VERSION;
  family: {
    key: string;
    name: string;
    description?: string;
  };
  version: {
    name: string;
    source: "figma" | "manual";
    sourceFileKey?: string;
    sourceVersion?: string;
  };
  fields: readonly TemplateBundleField[];
  fonts: readonly TemplateBundleFont[];
  assets: readonly TemplateBundleAsset[];
  variants: readonly TemplateBundleVariant[];
};

export type TemplateBundleIssue = {
  code:
    | "asset_reference"
    | "asset_quality"
    | "asset_shape"
    | "duplicate_key"
    | "field_reference"
    | "font_reference"
    | "publish_gate"
    | "geometry"
    | "schema_version"
    | "value";
  path: string;
  severity: "error" | "warning";
  message: string;
};

function issue(
  code: TemplateBundleIssue["code"],
  path: string,
  message: string,
  severity: TemplateBundleIssue["severity"] = "error"
): TemplateBundleIssue {
  return { code, path, severity, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validateUniqueKeys(
  records: readonly unknown[],
  path: string,
  issues: TemplateBundleIssue[]
) {
  const seen = new Set<string>();
  records.forEach((record, index) => {
    const key = isRecord(record) ? record.key : null;
    if (typeof key !== "string" || key.length === 0) {
      issues.push(issue("value", `${path}.${index}.key`, "Key is required."));
      return;
    }
    if (seen.has(key)) {
      issues.push(issue("duplicate_key", `${path}.${index}.key`, `Duplicate key "${key}".`));
    }
    seen.add(key);
  });
}

function isInsideCanvas(slot: Record<string, unknown>, canvas: { width: number; height: number }) {
  if (
    !isNonNegativeFinite(slot.x) ||
    !isNonNegativeFinite(slot.y) ||
    !isPositiveFinite(slot.width) ||
    !isPositiveFinite(slot.height)
  ) {
    return false;
  }
  return slot.x + slot.width <= canvas.width && slot.y + slot.height <= canvas.height;
}

export function validateTemplateBundleManifest(
  manifest: unknown
): TemplateBundleIssue[] {
  const issues: TemplateBundleIssue[] = [];
  if (!isRecord(manifest)) {
    return [issue("value", "manifest", "Manifest must be an object.")];
  }

  if (manifest.schemaVersion !== TEMPLATE_BUNDLE_SCHEMA_VERSION) {
    issues.push(
      issue(
        "schema_version",
        "schemaVersion",
        `Schema version must be ${TEMPLATE_BUNDLE_SCHEMA_VERSION}.`
      )
    );
  }

  const family = isRecord(manifest.family) ? manifest.family : {};
  if (typeof family.key !== "string" || family.key.length === 0) {
    issues.push(issue("value", "family.key", "Family key is required."));
  }
  if (typeof family.name !== "string" || family.name.length === 0) {
    issues.push(issue("value", "family.name", "Family name is required."));
  }

  const fields = asArray(manifest.fields);
  const fonts = asArray(manifest.fonts);
  const assets = asArray(manifest.assets);
  const variants = asArray(manifest.variants);

  if (fields.length === 0) issues.push(issue("value", "fields", "At least one field is required."));
  if (fonts.length === 0) issues.push(issue("value", "fonts", "At least one bundled font is required."));
  if (variants.length === 0) {
    issues.push(issue("value", "variants", "At least one variant is required."));
  }

  validateUniqueKeys(fields, "fields", issues);
  validateUniqueKeys(fonts, "fonts", issues);
  validateUniqueKeys(assets, "assets", issues);
  validateUniqueKeys(variants, "variants", issues);

  const fieldKeys = new Set(
    fields
      .map((field) => (isRecord(field) ? field.key : null))
      .filter((key): key is string => typeof key === "string" && key.length > 0)
  );
  const fontKeys = new Set(
    fonts
      .map((font) => (isRecord(font) ? font.key : null))
      .filter((key): key is string => typeof key === "string" && key.length > 0)
  );
  const assetKeys = new Set(
    assets
      .map((asset) => (isRecord(asset) ? asset.key : null))
      .filter((key): key is string => typeof key === "string" && key.length > 0)
  );

  fonts.forEach((font, index) => {
    if (!isRecord(font)) return;
    if (!assetKeys.has(String(font.asset))) {
      issues.push(
        issue("asset_reference", `fonts.${index}.asset`, `Font asset "${font.asset}" is not declared.`)
      );
    }
    if (!isPositiveFinite(font.weight)) {
      issues.push(issue("value", `fonts.${index}.weight`, "Font weight must be positive."));
    }
  });

  assets.forEach((asset, index) => {
    if (!isRecord(asset)) return;
    if (typeof asset.path !== "string" || asset.path.length === 0) {
      issues.push(issue("asset_shape", `assets.${index}.path`, "Asset path is required."));
    }
    if (typeof asset.sha256 !== "string" || asset.sha256.length < 32) {
      issues.push(issue("asset_shape", `assets.${index}.sha256`, "Asset checksum is required."));
    }
  });

  variants.forEach((variant, variantIndex) => {
    if (!isRecord(variant)) return;
    const canvas = { width: Number(variant.width), height: Number(variant.height) };
    if (!isPositiveFinite(variant.width) || !isPositiveFinite(variant.height)) {
      issues.push(issue("geometry", `variants.${variantIndex}`, "Variant canvas must have positive dimensions."));
    }
    for (const assetKey of ["referenceAsset", "backgroundAsset"] as const) {
      if (!assetKeys.has(String(variant[assetKey]))) {
        issues.push(
          issue(
            "asset_reference",
            `variants.${variantIndex}.${assetKey}`,
            `Asset "${variant[assetKey]}" is not declared.`
          )
        );
      }
    }

    asArray(variant.slots).forEach((slot, slotIndex) => {
      const slotPath = `variants.${variantIndex}.slots.${slotIndex}`;
      if (!isRecord(slot)) return;
      if (!fieldKeys.has(String(slot.field))) {
        issues.push(issue("field_reference", `${slotPath}.field`, `Field "${slot.field}" is not declared.`));
      }
      if (!isInsideCanvas(slot, canvas)) {
        issues.push(issue("geometry", slotPath, "Slot bounds must be positive and inside the canvas."));
      }
      if (slot.kind === "text") {
        if (!fontKeys.has(String(slot.fontKey))) {
          issues.push(issue("font_reference", `${slotPath}.fontKey`, `Font "${slot.fontKey}" is not declared.`));
        }
        if (!isPositiveFinite(slot.fontSize)) {
          issues.push(issue("value", `${slotPath}.fontSize`, "Text slot font size must be positive."));
        }
        if (!isPositiveFinite(slot.lineHeight)) {
          issues.push(issue("value", `${slotPath}.lineHeight`, "Text slot line height must be positive."));
        }
        if (!isPositiveFinite(slot.maxLines)) {
          issues.push(issue("value", `${slotPath}.maxLines`, "Text slot maxLines must be positive."));
        }
        if (slot.maxChars != null && !isPositiveFinite(slot.maxChars)) {
          issues.push(issue("value", `${slotPath}.maxChars`, "Text slot maxChars must be positive."));
        }
        if (slot.maxWords != null && !isPositiveFinite(slot.maxWords)) {
          issues.push(issue("value", `${slotPath}.maxWords`, "Text slot maxWords must be positive."));
        }
        if (slot.lineChars != null && !isPositiveFinite(slot.lineChars)) {
          issues.push(issue("value", `${slotPath}.lineChars`, "Text slot lineChars must be positive."));
        }
      }
    });
  });

  return issues;
}

export function templateBundleFieldsForVariant(
  manifest: TemplateBundleManifest,
  variantKey: string
): TemplateBundleField[] {
  const usedFields = new Set(
    manifest.variants
      .find((variant) => variant.key === variantKey)
      ?.slots.map((slot) => slot.field) ?? []
  );
  return manifest.fields.filter((field) => usedFields.has(field.key));
}
