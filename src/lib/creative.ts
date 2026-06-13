// Shared config for the creative studio — used by both the render route and
// the editor UI so sizes and backgrounds never drift apart.

export const SIZES = {
  ig_story: { label: "Instagram Story", w: 1080, h: 1920, channel: "Digital" },
  ig_post: { label: "Instagram Post", w: 1080, h: 1350, channel: "Digital" },
  square: { label: "Square Post", w: 1080, h: 1080, channel: "Digital" },
  fb_feed: { label: "Facebook Feed", w: 1200, h: 630, channel: "Digital" },
  a4_flyer: { label: "A4 Flyer", w: 1240, h: 1754, channel: "Print" },
} as const;

export type SizeKey = keyof typeof SIZES;

export const DEFAULT_SIZE: SizeKey = "ig_story";

export type Background = {
  label: string;
  from: string;
  to: string;
  angle: number;
  text: string;
  sub: string;
  chipBg: string;
  chipText: string;
};

export const BACKGROUNDS: Record<string, Background> = {
  forest: {
    label: "Forest",
    from: "#12312B",
    to: "#0E5F58",
    angle: 145,
    text: "#FFFFFF",
    sub: "#C9DAD3",
    chipBg: "#A9D3C6",
    chipText: "#0B2520",
  },
  cream: {
    label: "Cream",
    from: "#F6F6F3",
    to: "#E3EFEA",
    angle: 145,
    text: "#18221E",
    sub: "#5C6862",
    chipBg: "#0E5F58",
    chipText: "#FFFFFF",
  },
  sand: {
    label: "Sand",
    from: "#EFE7DA",
    to: "#E2D3BC",
    angle: 145,
    text: "#3A2E1E",
    sub: "#6B5B43",
    chipBg: "#3A2E1E",
    chipText: "#F6F0E6",
  },
  ink: {
    label: "Ink",
    from: "#161A1D",
    to: "#2A2F33",
    angle: 145,
    text: "#FFFFFF",
    sub: "#AEB6BB",
    chipBg: "#FFFFFF",
    chipText: "#161A1D",
  },
};

export type BackgroundKey = keyof typeof BACKGROUNDS;

export const DEFAULT_BACKGROUND = "forest";

export type CreativeInput = {
  size: SizeKey;
  bg: string;
  org: string;
  headline: string;
  cta: string;
  price: string;
  disclaimer: string;
  img: string; // optional product image URL
  approved: boolean; // show the "Approved" badge
};

// Neutral fallbacks only. Real text always comes from approved content,
// seeded by the editor — the studio never starts from invented copy.
export const DEFAULTS: CreativeInput = {
  size: DEFAULT_SIZE,
  bg: DEFAULT_BACKGROUND,
  org: "Your brand",
  headline: "",
  cta: "",
  price: "",
  disclaimer: "",
  img: "",
  approved: true,
};

export function buildRenderUrl(input: Partial<CreativeInput>): string {
  const merged = { ...DEFAULTS, ...input };
  const params = new URLSearchParams({
    size: merged.size,
    bg: merged.bg,
    org: merged.org,
    headline: merged.headline,
    cta: merged.cta,
    price: merged.price,
    disclaimer: merged.disclaimer,
    img: merged.img,
    approved: merged.approved ? "1" : "0",
  });
  return `/api/creative/render?${params.toString()}`;
}
