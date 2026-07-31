# Landing page — media spec

For `src/app/page.tsx`. Measured against the live page on 2026-07-31, container
`max-w-6xl` (1152px content width) at a 1280px viewport.

The page currently ships with **zero raster assets**. Every visual is CSS: borders,
type, and one teal blur in the hero. Nothing below is placeholder-filled — the slots
are listed so they can be designed, not so they can be stubbed.

Deliver at **2× the listed CSS size** for raster, or SVG where the asset is
diagrammatic. Formats: SVG for diagrams and UI vignettes, AVIF + WebP for photography
and renders, PNG only where transparency over the dark sections is required.

---

## The only authoritative palette is `globals.css`

Design against **`src/app/globals.css`** — near-monochrome `#0a0a0a` / `#f5f5f7`, one
teal accent `#00aa9f`, Inter. That is what the page is built on.

Do **not** infer the brand from anything else in the repo. Two other ContentGate
"looks" exist here and neither is authoritative:

- `public/template-bundles/contentgate-*` — deep green / cream / terracotta. Sample
  template content. **Wrong; do not design against it and do not use its renders.**
- `public/brand/contentgate/*.svg` — `#12312B` green, `#A9D3C6` mint, Plus Jakarta
  Sans. Unused by the app; neither the login page nor this page references them. Status
  unverified — confirm before treating them as the mark.

The same rule that applies to the seeded products applies to every rendered artefact
in this repo: it shows what the software can output, not what the brand is.

**Contrast floor for anything carrying text.** Body copy and small labels on this page
are held to WCAG AA and currently pass at 0 failures across 162 text elements. Two
tokens that look safe are not: `--color-ink-muted` is 4.35:1 and `--color-accent-dark`
is 4.05:1 on the `#f5f5f7` page background. White on the teal `#00aa9f` is 2.90:1 and
fails outright. Use `--color-ink-muted-strong` `#5f5f5f` and `--color-accent-deep`
`#00726b`.

---

## Slot 1 — Open Graph / social share image `MISSING, HIGHEST PRIORITY`

**1200 × 630**, PNG or JPEG under ~300KB. Goes in `src/app/opengraph-image.png`
(Next's file convention picks it up automatically; the `openGraph` block in
`page.tsx` already declares title and description but has no image).

Every link to contentgate.app currently previews blank in Slack, LinkedIn, and
iMessage. This is the one asset that is costing something today.

Must survive being scaled to a 120px-wide thumbnail — so wordmark plus one short
line, nothing more. Suggested line is the hero: *You don't need to be a marketer to
market well.*

Also worth adding: `src/app/icon.png` (512×512) and `apple-icon.png` (180×180). The
SVG favicons exist; the raster ones do not.

---

## Slot 2 — Hero visual `384px of dead column at desktop`

The hero container is 1152px wide; the text block is capped at 768px. That leaves a
**384px empty column** on the right at ≥1280px, and it currently holds nothing but a
teal blur. At <1024px the hero should stay text-only — do not design a visual the
mobile layout has to carry.

Target: **384 × 520** visible, but design on a larger canvas and let it bleed off the
right edge — the section is `overflow-hidden`, so a wider composition that runs off
the page reads better than a boxed image.

Sits on `#0a0a0a`. Needs to work with no border and no container.

---

## Slot 3 — Showcase creative `replaces the CSS schematic`

The strongest slot on the page, and the one Sesimi's Volvo demo does well. Currently
a diagrammatic CSS card explicitly labelled *"Schematic illustration, not live
output."* Replacing it with real renders removes that disclaimer.

Frame is **400 × 400 at desktop**, and swaps aspect ratio as the visitor picks a
format:

| Format control | Aspect | Frame at desktop |
|---|---|---|
| Social post | 1:1 | 400 × 400 |
| Story | 9:16 | 260 × 462 |
| A4 flyer | 210:297 | 320 × 453 |
| Link post | 1200:627 | 440 × 230 |

Also on the card: an **Approved** state chip (green dot + label, top right). It is the
only place on the page where governance shows up as a visual rather than a sentence,
so keep it if you redesign the card.

**Four assets**, one per format — the same campaign reflowing, so they must read as
one design at four aspect ratios, not four designs.

Localization is deliberately not demonstrated here. There is no language picker and
no language count anywhere on the page; do not reintroduce one through the media.

These have to be designed. The existing `contentgate-local-*` bundles are wrong and
`npm run contentgate:render-samples` output cannot be used here.

The card copy lives in `src/components/landing/campaign-showcase.tsx` — headline,
body, CTA, and an "Approved" state chip. Design against that text, or replace it
there.

---

## Slot 4 — Persona portraits `optional, high humanising value`

Five cards at **534 × 277** on `#f5f5f7`. The five narratives are the most human copy
on the page and currently carry no faces.

If photography: real people in their actual context — a rep in a car park on a phone,
a franchisee at a laptop late, a compliance lead with documents. Not stock
boardrooms.

**Constraint:** these must not read as customer testimonials. The company is
pre-first-customer with one org in production and zero export events, so no names, no
company names, no logos, no attributed quotes. Role labels only, as they are now.

---

## Slot 5 — How-it-works step marks `optional`

Five full-width rows, **1088 × 111**, three-column grid (`number | who + title |
body`). A **56 × 56** SVG mark per step would sit naturally in the number column.

Steps are: approve the sources · publish templates from Figma · fill in what only
they know · draft, cite, fit-check · release, then export.

---

## Slot 6 — Proof section vignettes `optional`

Six cards at **536 × 195** on `#0a0a0a`. Each states one enforcement guarantee.

The strongest single asset here is not six icons but **one wide UI vignette** of a
citation being inspected — the generated line, and the verbatim span of the approved
source highlighted underneath. That is the differentiator sentence in
`BRAND_AND_POSITIONING.md` §4 rendered as an image.

If it is a real screenshot rather than a drawing, curate it deliberately: zero of six
UX phases have shipped, so a wide capture of live Studio will show the contrast and
layout problems the audit documents.

---

## Slot 7 — The revert, closing CTA `optional, highest narrative value`

The closing section is *"See the revert."* — approve an asset, change one approved
word, watch it drop to draft and block the export. §9 calls that keystroke the moment
the product sells itself.

A **short silent loop** (MP4/WebM, ~6–10s, ~800 × 500) of exactly that state change
is the single most persuasive asset the page could carry. Must be `muted`,
`playsInline`, `loop`, with a poster frame, and must respect
`prefers-reduced-motion` — a static poster is the fallback, not a nice-to-have.

---

## Off limits

- **The seeded product assets** in `public/assets/` — Apex Canine, CaniGuard 5,
  DigestPro, PoultryShieldPro, SwineGuardPlus, VitalBite. They are fixtures, and
  using them silently commits the brand to animal health. `BRAND_AND_POSITIONING.md`
  §11 lists *which regulated category to name first* as an open decision.
- **The `contentgate-local-friendly` / `contentgate-local-premium` template bundles**
  and anything rendered from them. Wrong design; not the brand.
- **Customer logos, testimonials, award badges, "trusted by" walls.** Sesimi opens
  with Toyota and Mercedes; there is no true equivalent here yet.
- **Anything implying speed.** No stopwatches, no "2 minutes", no before/after
  timers. §5: there is no defensible end-to-end speed evidence.
- **Screenshots that imply mobile readiness.** Studio has zero responsive
  breakpoints. No phone mockups of the product UI.

---

## Wiring

No `<Image>` tags have been added and no files are referenced that do not exist — the
page builds and renders clean as it stands. Drop assets into `public/` and the slots
can be wired then; the OG image needs only to be placed at
`src/app/opengraph-image.png` to take effect, with no code change.
