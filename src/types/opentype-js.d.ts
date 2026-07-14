declare module "opentype.js" {
  export type Glyph = {
    advanceWidth?: number;
    index?: number;
  };

  export type Font = {
    unitsPerEm: number;
    charToGlyph(character: string): Glyph;
    getKerningValue(left: Glyph, right: Glyph): number;
  };

  export function parse(buffer: ArrayBuffer): Font;
}
