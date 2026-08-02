# Landing page — art direction and media spec

For `src/app/page.tsx`. Measured against the live page, container `max-w-6xl`
(1152px content width) at a 1280px viewport. Updated 2026-08-01 with case-study
research and a per-section verdict on whether a visual is warranted at all.

The page currently ships with **zero raster assets**. Every visual is CSS: borders,
type, and one teal blur in the hero.

Deliver at **2× the listed CSS size** for raster, or SVG where the asset is
diagrammatic. Formats: SVG for diagrams and UI vignettes, AVIF + WebP for photography
and renders, PNG only where transparency over the dark sections is required.

---

## Part 1 — What the best comparable pages actually do

Three pages were read in full. Two of them solve ContentGate's exact hard problem:
making *governance* — an abstract, invisible property — look like something.

### Vanta — the closest analogue

Vanta sells "prove you are compliant." Nothing about that is photographable, and they
solved it better than anyone in the category.

**Their method: cropped UI fragments carrying real, specific data.** They never show a
whole app window. Each product card in their bento grid is a tight crop of one
component, and the *data inside it* does the persuading:

- "SOC 2 compliance progress showing 87% completion with 115 tests, refreshed 3 minutes ago"
- "Inherent risk — High / Medium / Low on the vertical axis, a coloured 3×3 grid"
- "Third party risk: OpenAI critical, Intercom medium, Figma low"

Read those again without the picture. The *specificity* is the argument — 87%, 115
tests, three minutes ago. A generic shield icon would say nothing. This is the single
most transferable technique on this page.

Also worth stealing: their logo wall carries a **stat per logo** ("Eliminated 10
spreadsheets", "2,000 hrs saved annually", "Automated 93% of questionnaires") rather
than logos alone. ContentGate cannot use this yet — see Off limits.

Note what they *don't* illustrate: "All the frameworks you need" is a plain text link
grid. No icons. They spend visual budget where it converts and skip it elsewhere.

### Frontify — direct category competitor, and they have already built our showcase

Frontify's homepage is a sequence of **live interactive micro-demos**, not screenshots:
an asset grid whose metadata visibly auto-populates, a working search box with filter
chips, a guidelines nav tree, a chat transcript.

The one to study closely is **"Adapt, localize, and publish"** — a template with a
**Variables panel** listing `Logo, Text, Background · Button · Box · Headline · Image`,
beside the artefact those variables produce. That is ContentGate's showcase section,
already built by a competitor.

The lesson is what they show *together*: the **constraint and the output in one frame**.
Seeing the short list of things you're allowed to change is what communicates "locked
template" — far better than a sentence saying the layout is locked.

Their hero is a full-bleed image plus a logo wall: Microsoft, Budweiser, Telefónica,
OpenAI, Bayern Munich, Uber, Kia, Lufthansa.

### Sesimi — reviewed earlier

An interactive Volvo template builder: pick size, heading, model, background, watch a
real ad render. Strongest thing on their page. Confirms the interactive-artefact
pattern converts in this exact category.

### The three techniques worth copying

1. **Crop tight.** A component, not a window. Legible at 25% scale or it fails.
2. **Put real data in it.** "Rev. 4, approved 12 March by M. Santos" beats any icon.
3. **Show the constraint next to the output.** The list of what you *can't* change is
   the product.

---

## Part 2 — Section-by-section verdict

The page has eight sections. **Five should carry a visual. Three should stay text-only**
— and that alternation is exactly what makes the five land. A page where every section
has a graphic reads as a template; Vanta's text-only framework grid is doing real work
by making the sections around it feel deliberate.

| # | Section | Visual? | What |
|---|---|---|---|
| 1 | Hero | **Yes** | The output artefact, bleeding off the right edge |
| 2 | Showcase | **Yes — the centrepiece** | Real creative + a visible field/variables panel |
| 3 | The problem | **No** | Deliberately bare |
| 4 | Four messages | **No** | Deliberately bare |
| 5 | How it works | **Yes — one, not five** | A single wide pipeline diagram |
| 6 | Who it's for | **Yes** | Photography, in context |
| 7 | What holds it together | **Yes — one, not six** | The citation-inspection vignette |
| 8 | See the revert | **Yes** | Short silent loop |

---

### 1 — Hero `YES`

**384px of dead column** to the right of the text at ≥1280px, currently holding a teal
blur. Target **384 × 520 visible**, designed on a wider canvas and bled off the right
edge — the section is `overflow-hidden`, so a composition that runs past the viewport
reads better than a boxed image. Text-only below 1024px; do not design something the
mobile layout has to carry.

**What it should be: the thing the product makes.** One finished asset, angled or
offset, with its evidence visibly attached — a citation chip pinned to one line, an
"Approved" state, a revision number.

**Keep it distinct from section 2.** The hero shows the *output* — a single beautiful
finished artefact. The showcase shows the *mechanism* — the constraint and the swap.
If both are "a card on a dark background," the page repeats itself twice before the
fold. Different job, different treatment, different crop.

Sits on `#0a0a0a` with no border and no container.

### 2 — Showcase `YES — partly built; needs real creative`

**Superseded by the pinned scroll story** in `gate-story.tsx`. The standalone showcase
and citation card-grids are gone; both jobs are now beats in one continuous take.

What remains for design is the **artefact inside the story** — still a CSS schematic
labelled *"Schematic illustration, not live output."* Replacing it with real designed
creative removes that disclaimer and is the biggest single upgrade left.

The frame is **400 × 400 at desktop** and swaps aspect ratio with the format control:

| Format control | Aspect | Frame at desktop |
|---|---|---|
| Social post | 1:1 | 400 × 400 |
| Story | 9:16 | 260 × 462 |
| A4 flyer | 210:297 | 320 × 453 |
| Link post | 1200:627 | 440 × 230 |

**Four assets** — the same campaign reflowing, so they must read as one design at four
aspect ratios, not four designs.

**Add the Frontify move.** Beside the artefact, show the **declared fields** — the short
list of what opens: headline, subhead, offer, image, CTA. Everything else visibly
locked. That panel is what makes "the constraint is the product" land in one glance,
and right now the page only asserts it in prose.

Also on the card: an **Approved** state chip (green dot + label, top right). It is the
only place governance appears as a visual rather than a sentence — keep it.

Localization is deliberately not demonstrated. No language picker, no language count,
no named languages anywhere on the page. Do not reintroduce one through the media.

Copy and beat timings live in `src/components/landing/gate-story.tsx`.

### 3 — The problem `NO — and this is the strongest "no" on the page`

Three cards: headquarters makes everything / local teams make their own / agencies
in-market. Then the "Option four" callout.

**Leave them bare.** Three cards each with an icon is the single most generic pattern in
B2B, and it would actively weaken the best narrative writing on the page. This section
works on rhythm — three short verdicts, then the turn. Icons would make a reader skim it
as a feature grid.

If something must go here, it is *one* mark in the Option-four callout, not three in the
cards. Try the page without it first.

### 4 — Four messages `NO`

Four cards, numbered 01–04. Same reasoning, more so: four cards with four icons is the
most template-looking block in the genre. The numerals already carry the structure.

This is also the section that gives the eye a rest between the showcase and the
pipeline diagram. Filling it costs you the contrast that makes both of those land.

### 5 — How it works `YES — one diagram, not five icons`

Five full-width rows at **1088 × 111**, three-column grid (`number | who + title | body`).

The instinct is a 56 × 56 mark per step. **Do one wide horizontal pipeline diagram
above the rows instead** — approve sources → publish template → fill fields → draft,
cite, fit-check → approve → export — and leave the rows as text.

Two reasons: the value here is *comprehension of a sequence*, which a single flow
diagram delivers and five decorative icons do not; and one diagram is a fraction of the
design work. Roughly **1088 × 160**.

Mark the handoffs, since the page's argument is that only step 3 belongs to the person
at the edge. Colour or weight should make that one step visibly different.

### 6 — Who it's for `YES — highest emotional return on the page`

Five cards at **534 × 277** on `#f5f5f7`. The five persona narratives are the best copy
on the page and they are currently completely faceless.

**Real photography, in context.** A rep in a car park on a phone. A franchisee at a
laptop late at night. A compliance lead with marked-up documents. Not stock boardrooms,
not smiling headsets.

Vanta uses illustrated characters for their three segments; that also works and is
lower-risk than photography that lands badly. Either is defensible — what is not
defensible is a generic icon per persona.

**Hard constraint: these must not read as testimonials.** The company is
pre-first-customer with one organisation in production and zero export events. No
names, no company names, no logos, no attributed quotes. Role labels only, as now.

### 7 — What holds it together `YES — BUILT`

**Superseded by the scroll story**, where the citation match is beat 3: the sweep fills
the cited span and the approved-source panel rises beneath it.

This is the Vanta technique applied to the one thing ContentGate does that nobody else
does, and the specimen data does the persuading exactly as it does on their page. The
grid beneath dropped from six cards to five, since the vignette now carries the first
claim and its §4 sentence travels with it as a caption.

Nothing further is required here. If it is ever replaced with a real screenshot, curate
deliberately and check against current `main` first.

### 8 — See the revert `YES`

The closing section is *"See the revert."* — approve an asset, change one approved word,
watch it drop to draft and block the export. §9 of the positioning doc calls that
keystroke the moment the product sells itself.

A **short silent loop** (MP4/WebM, ~6–10s, ~800 × 500) of exactly that state change is
the most persuasive asset the page could carry. Must be `muted`, `playsInline`, `loop`,
with a poster frame, and must respect `prefers-reduced-motion` — a static poster is the
fallback, not a nice-to-have.

### Not a section, but first in priority — the OG image `MISSING`

**1200 × 630**, PNG or JPEG under ~300KB, at `src/app/opengraph-image.png` (Next's file
convention picks it up; no code change needed).

Every link to contentgate.app currently previews blank in Slack, LinkedIn, and iMessage.
This is the only asset costing something today. Must survive scaling to a 120px
thumbnail — wordmark plus one short line, nothing more.

Also missing: `src/app/icon.png` (512 × 512) and `apple-icon.png` (180 × 180). The SVG
favicons exist; the raster ones do not.

---

## The only authoritative palette is `globals.css`

Design against **`src/app/globals.css`** — near-monochrome `#0a0a0a` / `#f5f5f7`, teal
accent, Inter.

Do **not** infer the brand from anything else in the repo:

- `public/template-bundles/contentgate-*` — deep green / cream / terracotta.
  **Wrong; do not design against it and do not use its renders.**
- `public/brand/contentgate/*.svg` — `#12312B` green, mint, Plus Jakarta Sans. Unused by
  the app; neither the login page nor this page references them. Status unverified.

The rule that applies to the seeded products applies to every rendered artefact here: it
shows what the software can output, not what the brand is.

**Contrast floor.** The page holds at 0 failures across 143 text elements and should stay
there. Note the traps, which invert depending on background:

- `--color-ink-muted` is 4.35:1 on `--color-page` — under the floor. Use
  `--color-ink-muted-strong` `#5f5f5f`.
- `--color-brand` `#00756e` passes on light but is only **3.55:1 on `#0a0a0a`**. For
  accent text on dark use `--color-brand-on-dark` `#00aa9f`.

---

## Off limits

- **The seeded product assets** in `public/assets/` — Apex Canine, CaniGuard 5,
  DigestPro, PoultryShieldPro, SwineGuardPlus, VitalBite. Fixtures, and using them
  silently commits the brand to animal health. `BRAND_AND_POSITIONING.md` §11 lists
  *which regulated category to name first* as an open decision.
- **The `contentgate-local-*` template bundles** and anything rendered from them.
- **Customer logos, testimonials, award badges, "trusted by" walls, stat overlays.**
  Frontify opens with Microsoft and Uber; Vanta with Ramp and Snowflake, each carrying a
  savings number. There is no true equivalent here yet, and this is the single most
  tempting thing on both reference pages to imitate.
- **Anything implying speed.** No stopwatches, no "2 minutes", no before/after timers.
  §5: there is no defensible end-to-end speed evidence.
- **Screenshots implying mobile readiness.** No phone mockups of the product UI.

---

## Wiring

No `<Image>` tags have been added and no files are referenced that do not exist — the
page builds and renders clean as it stands. Drop assets into `public/` and the slots can
be wired then; the OG image needs only to be placed at `src/app/opengraph-image.png`.
