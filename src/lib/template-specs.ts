import type { FieldLimit, FieldLimits } from "./template-fields";

export type RenderFit = FieldLimit & {
  line_chars?: number;
};

type TemplateSpec = {
  effectiveLimits: FieldLimits;
  renderFits: Record<string, RenderFit>;
};

const SPECS: Record<string, TemplateSpec> = {
  digestpro_social: {
    effectiveLimits: {
      kicker: { max_chars: 44, max_lines: 1 },
      headline: { max_chars: 62, max_lines: 3 },
      supportCopy: { max_chars: 76, max_words: 10, max_lines: 2 },
      cta: { max_chars: 24, max_lines: 1 },
      contact: { max_chars: 26, max_lines: 1 },
      tagline: { max_chars: 44, max_lines: 2 },
    },
    renderFits: {
      kicker: { max_chars: 44 },
      headline: { max_chars: 62, max_lines: 3, line_chars: 22 },
      supportCopy: { max_chars: 76, max_words: 10, max_lines: 2, line_chars: 32 },
      cta: { max_chars: 24 },
      contact: { max_chars: 26 },
      tagline: { max_chars: 44, max_lines: 2, line_chars: 24 },
    },
  },
  digestpro_flyer: {
    effectiveLimits: {
      kicker: { max_chars: 44, max_lines: 1 },
      headline: { max_chars: 62, max_lines: 3 },
      body: { max_chars: 210, max_words: 34, max_lines: 5 },
      benefit_1: { max_chars: 34, max_lines: 3 },
      benefit_2: { max_chars: 34, max_lines: 3 },
      benefit_3: { max_chars: 34, max_lines: 3 },
      cta: { max_chars: 24, max_lines: 1 },
      contact: { max_chars: 26, max_lines: 1 },
      tagline: { max_chars: 44, max_lines: 2 },
    },
    renderFits: {
      kicker: { max_chars: 44 },
      headline: { max_chars: 62, max_lines: 3, line_chars: 24 },
      body: { max_chars: 210, max_words: 34, max_lines: 5, line_chars: 38 },
      benefit_1: { max_chars: 34, max_lines: 3, line_chars: 12 },
      benefit_2: { max_chars: 34, max_lines: 3, line_chars: 12 },
      benefit_3: { max_chars: 34, max_lines: 3, line_chars: 12 },
      cta: { max_chars: 24 },
      contact: { max_chars: 26 },
      tagline: { max_chars: 44, max_lines: 2, line_chars: 24 },
    },
  },
  digestpro_presentation: {
    effectiveLimits: {
      headline: { max_chars: 62, max_lines: 3 },
      supportCopy: { max_chars: 90, max_words: 12, max_lines: 2 },
      cta: { max_chars: 24, max_lines: 1 },
      contact: { max_chars: 26, max_lines: 1 },
      tagline: { max_chars: 44, max_lines: 2 },
    },
    renderFits: {
      headline: { max_chars: 62, max_lines: 3, line_chars: 24 },
      supportCopy: { max_chars: 90, max_words: 12, max_lines: 2, line_chars: 35 },
      cta: { max_chars: 24 },
      contact: { max_chars: 26 },
      tagline: { max_chars: 44, max_lines: 2, line_chars: 24 },
    },
  },
  caniguard5_social: {
    effectiveLimits: {
      kicker: { max_chars: 34, max_lines: 1 },
      headline: { max_chars: 50, max_lines: 3 },
      supportCopy: { max_chars: 86, max_words: 12, max_lines: 3 },
      cta: { max_chars: 24, max_lines: 1 },
      contact: { max_chars: 26, max_lines: 1 },
      tagline: { max_chars: 54, max_lines: 2 },
    },
    renderFits: {
      kicker: { max_chars: 34 },
      headline: { max_chars: 50, max_lines: 3, line_chars: 18 },
      supportCopy: { max_chars: 86, max_words: 12, max_lines: 3, line_chars: 32 },
      cta: { max_chars: 24 },
      contact: { max_chars: 26 },
      tagline: { max_chars: 54, max_lines: 2, line_chars: 26 },
    },
  },
  caniguard5_flyer: {
    effectiveLimits: {
      kicker: { max_chars: 34, max_lines: 1 },
      headline: { max_chars: 50, max_lines: 3 },
      body: { max_chars: 185, max_words: 30, max_lines: 5 },
      benefit_1: { max_chars: 34, max_lines: 2 },
      benefit_2: { max_chars: 34, max_lines: 2 },
      benefit_3: { max_chars: 34, max_lines: 2 },
      cta: { max_chars: 24, max_lines: 1 },
      contact: { max_chars: 26, max_lines: 1 },
      tagline: { max_chars: 54, max_lines: 2 },
    },
    renderFits: {
      kicker: { max_chars: 34 },
      headline: { max_chars: 50, max_lines: 3, line_chars: 20 },
      body: { max_chars: 185, max_words: 30, max_lines: 5, line_chars: 32 },
      benefit_1: { max_chars: 34, max_lines: 2, line_chars: 17 },
      benefit_2: { max_chars: 34, max_lines: 2, line_chars: 17 },
      benefit_3: { max_chars: 34, max_lines: 2, line_chars: 17 },
      cta: { max_chars: 24 },
      contact: { max_chars: 26 },
      tagline: { max_chars: 54, max_lines: 2, line_chars: 26 },
    },
  },
  caniguard5_presentation: {
    effectiveLimits: {
      headline: { max_chars: 50, max_lines: 3 },
      supportCopy: { max_chars: 86, max_words: 12, max_lines: 3 },
      cta: { max_chars: 24, max_lines: 1 },
      contact: { max_chars: 26, max_lines: 1 },
      tagline: { max_chars: 54, max_lines: 2 },
    },
    renderFits: {
      headline: { max_chars: 50, max_lines: 3, line_chars: 18 },
      supportCopy: { max_chars: 86, max_words: 12, max_lines: 3, line_chars: 33 },
      cta: { max_chars: 24 },
      contact: { max_chars: 26 },
      tagline: { max_chars: 54, max_lines: 2, line_chars: 26 },
    },
  },
  poultryshieldpro_social: {
    effectiveLimits: {
      kicker: { max_chars: 40, max_lines: 1 },
      headline: { max_chars: 42, max_lines: 3 },
      supportCopy: { max_chars: 68, max_words: 9, max_lines: 2 },
      cta: { max_chars: 24, max_lines: 1 },
    },
    renderFits: {
      kicker: { max_chars: 40 },
      headline: { max_chars: 42, max_lines: 3, line_chars: 16 },
      supportCopy: { max_chars: 68, max_words: 9, max_lines: 2, line_chars: 28 },
      cta: { max_chars: 24 },
    },
  },
  poultryshieldpro_flyer: {
    effectiveLimits: {
      kicker: { max_chars: 40, max_lines: 1 },
      headline: { max_chars: 46, max_lines: 3 },
      body: { max_chars: 128, max_words: 20, max_lines: 4 },
      benefit_1: { max_chars: 30, max_lines: 2 },
      benefit_2: { max_chars: 30, max_lines: 2 },
      benefit_3: { max_chars: 30, max_lines: 2 },
      cta: { max_chars: 24, max_lines: 1 },
      contact: { max_chars: 28, max_lines: 1 },
    },
    renderFits: {
      kicker: { max_chars: 40 },
      headline: { max_chars: 46, max_lines: 3, line_chars: 18 },
      body: { max_chars: 128, max_words: 20, max_lines: 4, line_chars: 30 },
      benefit_1: { max_chars: 30, max_lines: 2, line_chars: 20 },
      benefit_2: { max_chars: 30, max_lines: 2, line_chars: 20 },
      benefit_3: { max_chars: 30, max_lines: 2, line_chars: 20 },
      cta: { max_chars: 24 },
      contact: { max_chars: 28, max_lines: 1, line_chars: 26 },
    },
  },
  poultryshieldpro_presentation: {
    effectiveLimits: {
      headline: { max_chars: 42, max_lines: 3 },
      supportCopy: { max_chars: 70, max_words: 9, max_lines: 2 },
      cta: { max_chars: 24, max_lines: 1 },
    },
    renderFits: {
      headline: { max_chars: 42, max_lines: 3, line_chars: 20 },
      supportCopy: { max_chars: 70, max_words: 9, max_lines: 2, line_chars: 34 },
      cta: { max_chars: 24 },
    },
  },
  swineguardplus_social: {
    effectiveLimits: {
      kicker: { max_chars: 40, max_lines: 1 },
      headline: { max_chars: 42, max_lines: 3 },
      supportCopy: { max_chars: 70, max_words: 9, max_lines: 2 },
      cta: { max_chars: 24, max_lines: 1 },
    },
    renderFits: {
      kicker: { max_chars: 40 },
      headline: { max_chars: 42, max_lines: 3, line_chars: 16 },
      supportCopy: { max_chars: 70, max_words: 9, max_lines: 2, line_chars: 32 },
      cta: { max_chars: 24 },
    },
  },
  swineguardplus_flyer: {
    effectiveLimits: {
      kicker: { max_chars: 40, max_lines: 1 },
      headline: { max_chars: 44, max_lines: 3 },
      body: { max_chars: 75, max_words: 12, max_lines: 2 },
      benefit_1: { max_chars: 30, max_lines: 3 },
      benefit_2: { max_chars: 30, max_lines: 3 },
      benefit_3: { max_chars: 30, max_lines: 3 },
      cta: { max_chars: 24, max_lines: 1 },
      contact: { max_chars: 28, max_lines: 1 },
    },
    renderFits: {
      kicker: { max_chars: 40 },
      headline: { max_chars: 44, max_lines: 3, line_chars: 17 },
      body: { max_chars: 75, max_words: 12, max_lines: 2, line_chars: 37 },
      benefit_1: { max_chars: 30, max_lines: 3, line_chars: 15 },
      benefit_2: { max_chars: 30, max_lines: 3, line_chars: 15 },
      benefit_3: { max_chars: 30, max_lines: 3, line_chars: 15 },
      cta: { max_chars: 24, max_lines: 1, line_chars: 24 },
      contact: { max_chars: 28 },
    },
  },
  swineguardplus_presentation: {
    effectiveLimits: {
      headline: { max_chars: 42, max_lines: 3 },
      supportCopy: { max_chars: 70, max_words: 9, max_lines: 2 },
      cta: { max_chars: 24, max_lines: 1 },
    },
    renderFits: {
      headline: { max_chars: 42, max_lines: 3, line_chars: 20 },
      supportCopy: { max_chars: 70, max_words: 9, max_lines: 2, line_chars: 34 },
      cta: { max_chars: 24 },
    },
  },
};

function minDefined(a?: number, b?: number) {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

function mergeLimit(base: FieldLimit | undefined, override: FieldLimit | undefined): FieldLimit | undefined {
  if (!base && !override) return undefined;
  return {
    max_chars: minDefined(base?.max_chars, override?.max_chars),
    max_words: minDefined(base?.max_words, override?.max_words),
    max_lines: minDefined(base?.max_lines, override?.max_lines),
  };
}

export function normalizeLayoutKey(layoutKey?: string | null): string | null {
  if (!layoutKey) return null;
  if (layoutKey in SPECS) return layoutKey;

  const prefixes = [
    "digestpro_",
    "caniguard5_",
    "poultryshieldpro_",
    "swineguardplus_",
  ];
  const prefix = prefixes.find((candidate) => layoutKey.startsWith(candidate));
  if (!prefix) return null;

  if (layoutKey.includes("flyer")) return `${prefix}flyer`;
  if (layoutKey.includes("presentation")) return `${prefix}presentation`;
  return `${prefix}social`;
}

export function resolveEffectiveFieldLimits(
  layoutKey: string | null | undefined,
  fieldLimits: FieldLimits
): FieldLimits {
  const normalized = normalizeLayoutKey(layoutKey);
  if (!normalized) return fieldLimits;

  const spec = SPECS[normalized];
  const merged: FieldLimits = { ...fieldLimits };
  for (const key of new Set([...Object.keys(fieldLimits), ...Object.keys(spec.effectiveLimits)])) {
    const limit = mergeLimit(fieldLimits[key], spec.effectiveLimits[key]);
    if (limit) merged[key] = limit;
  }
  return merged;
}

export function getRenderFits(layoutKey: string | null | undefined): Record<string, RenderFit> {
  const normalized = normalizeLayoutKey(layoutKey);
  return normalized ? SPECS[normalized]?.renderFits ?? {} : {};
}
