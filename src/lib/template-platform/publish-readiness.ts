import type {
  TemplateBundleAsset,
  TemplateBundleField,
  TemplateBundleIssue,
  TemplateBundleManifest,
  TemplateBundleTextSlot,
  TemplateBundleVariant,
} from "./manifest.ts";

type ReadinessOptions = {
  strict?: boolean;
};

function issue(
  code: TemplateBundleIssue["code"],
  path: string,
  message: string,
  severity: TemplateBundleIssue["severity"] = "error"
): TemplateBundleIssue {
  return { code, path, message, severity };
}

function assetByKey(manifest: TemplateBundleManifest) {
  return new Map(manifest.assets.map((asset) => [asset.key, asset]));
}

function fieldByKey(manifest: TemplateBundleManifest) {
  return new Map(manifest.fields.map((field) => [field.key, field]));
}

function fontsByKey(manifest: TemplateBundleManifest) {
  return new Map(manifest.fonts.map((font) => [font.key, font]));
}

function assetPathLooksLikeFont(asset: TemplateBundleAsset) {
  return /\.(otf|ttf|woff2?)$/i.test(asset.path);
}

function imageAssetIsUsableForVariant(
  asset: TemplateBundleAsset,
  variant: TemplateBundleVariant
) {
  if (!asset.width || !asset.height) return false;
  const scaleX = asset.width / variant.width;
  const scaleY = asset.height / variant.height;
  return (
    scaleX >= 1 &&
    scaleY >= 1 &&
    Math.abs(scaleX - scaleY) < 0.01 &&
    Math.abs(Math.round(scaleX) - scaleX) < 0.01
  );
}

function slotLineBoxFits(slot: TemplateBundleTextSlot) {
  return slot.fontSize * slot.lineHeight * slot.maxLines <= slot.height + 0.5;
}

function fieldAcceptsSlot(field: TemplateBundleField | undefined, kind: "image" | "text") {
  if (!field) return false;
  if (kind === "text") return field.type === "text" || field.type === "enum" || field.type === "date" || field.type === "number";
  return field.type === "image" || field.type === "asset_choice";
}

export function validateTemplateBundlePublishReadiness(
  manifest: TemplateBundleManifest,
  options: ReadinessOptions = {}
): TemplateBundleIssue[] {
  const strict = options.strict ?? true;
  const issues: TemplateBundleIssue[] = [];
  const assets = assetByKey(manifest);
  const fields = fieldByKey(manifest);
  const fonts = fontsByKey(manifest);

  if (manifest.version.source === "figma" && !manifest.version.sourceFileKey) {
    issues.push(
      issue(
        "publish_gate",
        "version.sourceFileKey",
        "Figma-derived templates must include the source Figma file key."
      )
    );
  }

  manifest.fonts.forEach((font, fontIndex) => {
    const asset = assets.get(font.asset);
    if (!asset) return;
    if (asset.kind !== "font") {
      issues.push(
        issue(
          "font_reference",
          `fonts.${fontIndex}.asset`,
          `Font "${font.key}" must reference a font asset, not "${asset.kind}".`
        )
      );
    }
    if (font.sha256 !== asset.sha256) {
      issues.push(
        issue(
          "asset_quality",
          `fonts.${fontIndex}.sha256`,
          `Font "${font.key}" checksum must match its bundled asset checksum.`
        )
      );
    }
    if (!assetPathLooksLikeFont(asset)) {
      issues.push(
        issue(
          "asset_quality",
          `assets.${manifest.assets.indexOf(asset)}.path`,
          `Font asset "${asset.key}" must use a font file extension.`
        )
      );
    }
  });

  manifest.variants.forEach((variant, variantIndex) => {
    const reference = assets.get(variant.referenceAsset);
    const background = assets.get(variant.backgroundAsset);
    const variantPath = `variants.${variantIndex}`;

    if (variant.slots.length === 0) {
      issues.push(
        issue("publish_gate", `${variantPath}.slots`, "Publishable variants must expose at least one editable slot.")
      );
    }

    const seenSlotKeys = new Set<string>();
    variant.slots.forEach((slot, slotIndex) => {
      const slotPath = `${variantPath}.slots.${slotIndex}`;
      if (seenSlotKeys.has(slot.key)) {
        issues.push(issue("duplicate_key", `${slotPath}.key`, `Duplicate slot key "${slot.key}".`));
      }
      seenSlotKeys.add(slot.key);

      const field = fields.get(slot.field);
      if (slot.kind === "text") {
        if (!fieldAcceptsSlot(field, "text")) {
          issues.push(
            issue(
              "field_reference",
              `${slotPath}.field`,
              `Text slot "${slot.key}" must reference a text-compatible field.`
            )
          );
        }
        if (!fonts.has(slot.fontKey)) {
          return;
        }
        if (!slot.maxChars && !slot.maxWords) {
          issues.push(
            issue(
              "publish_gate",
              `${slotPath}.maxChars`,
              `Text slot "${slot.key}" needs maxChars or maxWords so generated copy can be bounded.`
            )
          );
        }
        if (!slotLineBoxFits(slot)) {
          issues.push(
            issue(
              "geometry",
              `${slotPath}.height`,
              `Text slot "${slot.key}" cannot fit ${slot.maxLines} line(s) at its declared font size and line height.`
            )
          );
        }
        if (slot.fit === "shrink_to_fit" && (!slot.minFontSize || slot.minFontSize <= 0)) {
          issues.push(
            issue(
              "publish_gate",
              `${slotPath}.minFontSize`,
              `Shrink-to-fit text slot "${slot.key}" must declare a positive minFontSize.`
            )
          );
        }
      } else if (!fieldAcceptsSlot(field, "image")) {
        issues.push(
          issue(
            "field_reference",
            `${slotPath}.field`,
            `Image slot "${slot.key}" must reference an image-compatible field.`
          )
        );
      }
    });

    if (reference) {
      if (reference.kind !== "reference") {
        issues.push(
          issue("asset_reference", `${variantPath}.referenceAsset`, "referenceAsset must point to a reference asset.")
        );
      }
      if (!imageAssetIsUsableForVariant(reference, variant)) {
        issues.push(
          issue(
            "asset_quality",
            `${variantPath}.referenceAsset`,
            "Reference image must include dimensions at 1x, 2x, or 3x of the variant canvas."
          )
        );
      }
      if (strict && !reference.mimeType?.startsWith("image/")) {
        issues.push(
          issue("asset_quality", `${variantPath}.referenceAsset`, "Reference asset must declare an image MIME type.")
        );
      }
    }

    if (background) {
      if (background.kind !== "background") {
        issues.push(
          issue("asset_reference", `${variantPath}.backgroundAsset`, "backgroundAsset must point to a background asset.")
        );
      }
      if (!imageAssetIsUsableForVariant(background, variant)) {
        issues.push(
          issue(
            "asset_quality",
            `${variantPath}.backgroundAsset`,
            "Background image must include dimensions at 1x, 2x, or 3x of the variant canvas."
          )
        );
      }
      if (strict && !background.mimeType?.startsWith("image/")) {
        issues.push(
          issue("asset_quality", `${variantPath}.backgroundAsset`, "Background asset must declare an image MIME type.")
        );
      }
    }

    if (reference && background) {
      if (reference.key === background.key || reference.path === background.path) {
        issues.push(
          issue(
            "publish_gate",
            `${variantPath}.backgroundAsset`,
            "Generated mode needs a separate clean background asset, not the full reference image."
          )
        );
      }
      if (reference.sha256 === background.sha256) {
        issues.push(
          issue(
            "publish_gate",
            `${variantPath}.backgroundAsset`,
            "Background and reference assets have the same checksum; export a text-free background."
          )
        );
      }
    }
  });

  return issues;
}
