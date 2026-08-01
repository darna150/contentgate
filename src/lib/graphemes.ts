const segmenters = new Map<string, Intl.Segmenter>();

function segmenter(locale?: string) {
  const key = locale || "und";
  let current = segmenters.get(key);
  if (!current) {
    current = new Intl.Segmenter(locale, { granularity: "grapheme" });
    segmenters.set(key, current);
  }
  return current;
}
/** User-visible characters, not UTF-16 code units. */
export function splitGraphemes(value: unknown, locale?: string): string[] {
  const text = String(value ?? "");
  if (!text) return [];
  if (typeof Intl.Segmenter !== "function") return Array.from(text);
  return Array.from(segmenter(locale).segment(text), ({ segment }) => segment);
}

export function graphemeCount(value: unknown, locale?: string): number {
  return splitGraphemes(value, locale).length;
}

export function sliceGraphemes(
  value: unknown,
  start: number,
  end?: number,
  locale?: string
): string {
  return splitGraphemes(value, locale).slice(start, end).join("");
}
