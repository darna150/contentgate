# Handoff: ContentGate Redesign

## Overview
A full visual + UX redesign of ContentGate — a brand-content governance platform where distributed teams generate localized marketing assets from locked, designer-made templates, with an approval workflow gating every export. This package covers all 19 routes across the `admin` and `member` roles, built around one design system and a small set of shared patterns (status pill, ¶-numbered citation, dashboard summary panel, Studio two-column shell).

## About the Design Files
The bundled file (`ContentGate.dc.html`) is a **design reference built in HTML** — a working, clickable prototype demonstrating layout, states, copy, and interaction, not production code to copy verbatim. It is a single self-contained file using a lightweight in-house templating runtime (not React/Vue directly) purely so it could be prototyped quickly. **Do not port its runtime or markup structure as-is.** The task is to recreate this design in ContentGate's real codebase, using its existing framework, component library, routing, and data layer — matching the visual spec below pixel-for-pixel where colors/type/spacing are given, and using sound judgement for anything the prototype fakes with static sample data.

Open the HTML file directly in a browser to click through every screen and state before implementing.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and component states below are final — implement pixel-accurately. Sample content (product names like "Ridgeline Pack," people's names, document text) is placeholder copy invented for the prototype and should be replaced with real data from the actual backend.

## Design system grounding
The visual language is adapted from the "justdebbie.ing" editorial design system (near-monochrome base, one functional accent color, Inter throughout, hairline borders, restrained shadows). If the real ContentGate codebase already has its own component library and tokens, prefer those exact primitives (buttons, inputs, cards) and just carry over this spec's layout, color mapping, and interaction patterns — don't introduce a second design system.

---

## Design tokens

**Color**
- `--ink-950` `#0A0A0A` — sidebar background, primary headings, high-emphasis buttons
- `--white` `#FFFFFF` — cards, page chrome
- `--haze` `#F5F5F7` — page background (alternates with white for section rhythm)
- `--neutral-300` `#D4D4D4` — input borders, hairlines on inputs
- `--neutral-200` `#E5E5E5` — card borders, table row dividers
- `--neutral-400` `#A3A3A3` — muted labels, eyebrows, placeholder icons
- `--neutral-500` `#737373` — secondary body text
- `--neutral-600` `#525252` — deeper body text (table cells)
- `--teal` `#00AA9F` — the ONE functional accent: primary CTAs, links, active states, "Approved" status, citation ¶ marks
- `--teal-tint` `#E6F7F5` — pale accent backgrounds (banners, approved-pill fill, user chat bubble)
- `--teal-tint-border` `#B9E9E4`
- `--amber` `#9A6A1E` on `#FBF3E6` fill, border `#E8D3AE` — "In review" status
- `--brick` `#A23B2E` on `#FBEDEA` fill, border `#F0D6D1` — "Rejected" status, urgent/blocked indicators, destructive actions
- `--draft-gray` `#737373` on transparent fill, border `#D4D4D4` — "Draft" status

**Type**
- Font family: Inter (400/500/600/700/800 weights), fallback `-apple-system, sans-serif`
- Eyebrows/section labels: 11px, weight 700, uppercase, `letter-spacing: 0.16–0.2em`, color `neutral-400`
- Page H1: 28–32px, weight 700, `letter-spacing: -0.03em`, color `#0A0A0A`
- Card/section headers: 15–17px, weight 600–700, `letter-spacing: -0.01em to -0.02em`
- Body: 13–15px, weight 400–600, `neutral-500/600`
- Monospace (Template Ops bundle names/versions only): `ui-monospace, monospace`

**Spacing / shape**
- Page padding: 40px 48px desktop
- Card border radius: 10–12px; pills/chips: fully rounded (9999px); small tags: 6–8px
- Card border: 1px solid `neutral-200`, no shadow at rest
- Elevated/floating elements only (Studio canvas): `box-shadow: 0 24px 70px rgba(0,0,0,0.10)`
- Sidebar width: 248px fixed, collapses to a slide-in drawer + hamburger under 768px

**Motion**
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` everywhere
- Page-content entrance: fade + 6px rise, ~0.5s
- Citation card expand: fade + rise, ~0.3s
- Drawer slide: `transform` 0.3s

---

## Global shell
Present on every authenticated route.

**Sidebar** (248px, fixed, `#0A0A0A` background, 20px/16px padding):
1. Logo mark: 26×26px rounded-square (`radius:7px`) teal (`#00AA9F`) tile with bold "C", plus lowercase wordmark "contentgate" (white, 700 weight, -0.03em tracking).
2. Workspace card: hairline border (`rgba(255,255,255,0.1)`), workspace name (white, 600) + role eyebrow ("ADMIN WORKSPACE" / "MEMBER WORKSPACE", `rgba(255,255,255,0.35)`).
3. Primary nav (core, all roles): Dashboard, Products, Content, Approvals (teal pill badge showing live pending count), Assets, Ask. Active item: `rgba(255,255,255,0.08)` background pill, white 700-weight text. Inactive: `rgba(255,255,255,0.65)`, 500-weight.
4. Admin section (admin role only): separated by a hairline rule + "ADMIN" eyebrow, contains Source Documents, Template Ops — same active/inactive treatment as core nav.
5. Bottom: user avatar initials in a translucent circle, name, "Sign out" (muted, links to `/login`).

**Responsive**: below 768px, sidebar becomes `position: fixed`, off-canvas (`translateX(-100%)`), toggled by a hamburger button in a sticky top bar; a dark scrim (`rgba(10,10,10,0.4)`) covers the content when open.

---

## Shared components (build these once, reuse everywhere)

### 1. Status pill
Used in Content ledger, Approvals queue, Studio header, Product Overview. Rounded-full pill, small 6px dot + label, 12px/600-weight text:
- Draft: gray dot/text, no fill, `neutral-300` border
- In review: amber dot/text, `#FBF3E6` fill, `#E8D3AE` border
- Approved: teal dot, `#00877E` text, `#E6F7F5` fill, `#B9E9E4` border
- Rejected: brick dot/text, `#FBEDEA` fill, `#F0D6D1` border

### 2. ¶-numbered citation (the product's core-promise component — treat as first-class, not an afterthought)
One shared component used in three places: **Ask** answers ("FROM APPROVED SOURCES" citation row), **Source Documents** detail view (every paragraph is numbered and directly addressable), and **Approved Claims** (each claim traces back to a source paragraph).
- Compact form (Ask): a quiet pill — `¶N` in teal bold + doc title in `neutral-600` — click to expand an inline card below it showing the exact quoted paragraph (italic) + "View in Source Documents →" link, on a `#fafafa` background with a 3px teal left border.
- Full form (Source Documents detail): each paragraph rendered as `¶N` badge (teal text, teal-tint fill, teal-tint border, rounded-full) beside the paragraph text at 15px.

### 3. Dashboard summary panel (banner + 3 stat tiles + activity/status list)
One component, reused with a **scope** parameter (`workspace` | `product`):
- Pending-review banner: teal-tint background, 4px solid teal left border, rounded on the right only, message + "Review now →" teal link.
- 3 stat tiles in a row: white card, hairline border, 11px uppercase eyebrow label, 34px/700-weight number (teal for the "In review" tile only), small muted caption below.
- Below: either a recent-activity list (workspace scope, on Dashboard) or a scoped list of templates/content/approvals (product scope, on Product Overview tabs) — same tile/banner header, different table body.

### 4. Studio two-column shell
The core authoring tool — was two separate, redundant toggles; now unified.
- **Left column** (400px fixed, scrollable): author mode shows language select, 9 refinement chips (single-select pill row) + Regenerate button, 4 locked background-style swatches (44×44px, teal ring on selection), then per-field inputs (Headline/Subhead/CTA) each with a live `{count}/{limit} · fits/over by N` indicator (teal when fitting, brick when over), Submit for review CTA. Reviewer mode (toggled via header link) swaps this column for a read-only summary + comment box + Approve/Reject buttons.
- **Right column**: one unified control row — output-size pill tabs (Square 1080×1080, Story 1080×1920, Link Ad 1200×628, Leaderboard 728×90, Medium Rectangle 300×250, each showing dims in small muted text) with a small "Your draft / Brand reference" segmented control docked beside it (not a second separate toggle elsewhere on the page). Below: a live-rendered canvas (background swatch + headline/subhead/CTA text, sized/scaled to the selected output's real aspect ratio, capped to fit the available width) in draft mode, or a "baked Figma export, read-only" placeholder in reference mode. Footer row: format select + Export (disabled/locked with an explanatory label until the content is Approved).

---

## Screens / Routes

### Public
**`/login`** — split screen. Left: `#0A0A0A` panel, logo, large (44px/700) headline, muted supporting line. Right: `#F5F5F7` panel, centered sign-in form (email, password, teal "Enter workspace" button), max-width 340px.

### Core (all roles)
**`/dashboard`** — Uses the shared summary panel at workspace scope. Greeting H1 ("Good afternoon, {name}."), banner, 3 tiles (Documents / Content / In review), recent activity feed below (actor + verb + target + relative time, hairline-divided rows).

**`/products`** — Responsive card grid (`minmax(240px,1fr)`), each card: category eyebrow (teal), product name (17px/700), one-line description, template/content counts. "+ New product" button top-right.

**`/products/new`** — Simple stacked form: name, category, description → Create.

**`/products/[id]`** — Tabbed: Overview / Templates / Content / Approvals / Knowledge / Assets. Tab bar: flat pill tabs, active = `#0A0A0A` fill/white text. Overview reuses the shared summary panel at product scope. Other tabs are simple filtered lists scoped to that product (reusing the Content ledger row, Approvals row, Template Ops row, and Asset card patterns respectively — don't rebuild these renderers per tab).

**`/products/[id]/edit`** — Product detail form (name, description) + **Approved Claims manager**: each claim is a row with its text and three tri-state controls — **Active** (teal-tinted when selected), **Inactive** (neutral-gray when selected), **Delete** (brick, when selected the row dims to 45% opacity and the text gets a strikethrough — deletion is soft/reversible, not a destructive removal from the list).

**`/content`, `/content/[id]`** — Workspace-wide ledger. Filter pills across the top (status: All/Draft/In review/Approved/Rejected — active pill is `#0A0A0A` fill). Desktop: 6-column grid table (Title 2.2fr / Language 0.8fr / Size 0.7fr / Status 1.3fr / Owner 1fr / Updated 0.8fr — Status needs the wider track so pills don't clip). **Below 768px, do not horizontal-scroll the table** — switch to stacked cards (title, product · language · size line, status pill + owner/updated line) instead. Row click opens Studio.

**`/studio/new`, `/studio/[contentId]`** — See "Studio two-column shell" above. Header: back-to-content link, content title, "Preview as reviewer" / "Exit reviewer view" toggle (this is how the reviewer-mode swap is demonstrated in the prototype — replace with real per-user permission logic).

**`/approvals`** — Flat, workspace-wide list of everything In review. Language filter pills at top. Each row: 4px left border colored by urgency (teal if fresh/<6h, transparent/neutral if normal, **brick if waiting >2 days** — this is the "age-based urgency escalation" fix for the old badge-color-only status system), title + product/language/submitter line, right-aligned "waiting Xh/Xd" label (brick + bold when urgent) plus a "BLOCKED ON YOU" tag when urgent, and a dark "Review" button that opens Studio in reviewer mode.

**`/assets`** — Governed library. Left rail: **Collections** (All assets, one per product, plus "Brand" for unassigned/brand-wide bundles), each with a live count; selecting one filters the grid. Right: search input, Grid/List segmented toggle, Upload button, then either an image-card grid (aspect-ratio 4:3 placeholder + filename + product/tags) or a compact list.

**`/ask`** — Knowledge Hub chat. User messages: right-aligned teal-tint bubble. Assistant messages: white card, followed by a teal "FROM APPROVED SOURCES" eyebrow and a row of citation chips (see shared component #2) — every answer must ship with at least one citation card; never render a bare assistant answer with no source trail.

### Admin only
**`/knowledge`, `/knowledge/new`** — Simple list (title, type, paragraph count, updated-time) + an upload/add-document form with a dashed drop zone ("paragraphs are auto-numbered for citation once processed").

**`/knowledge/[id]`** — Numbered-paragraph detail view using the ¶ citation component's full form (see shared component #2) — this is the canonical source that Ask citations and Approved Claims both point back to.

**`/templates`** — Template Ops. Deliberately denser/more technical than the rest of the app (explicit design decision — this is ops tooling, not an authoring surface): a compact monospace table (bundle name, version, product, status pill, preflight result colored teal/amber/brick, updated time) instead of cards. "+ import bundle" action for new manifest uploads; a preflight step should block publishing until it passes (surfaced today as a colored inline result, e.g. "Failed — Leaderboard overflow").

---

## Interactions & behavior notes
- Approvals urgency escalation, reviewer-mode toggle, claim tri-state, and the Studio unified size/view control are the four "known problems" this redesign explicitly solves — preserve their behavior, don't regress to the old patterns (duplicated dashboard markup, two independent Studio toggles, badge-color-only status, three bespoke citation renderers).
- Export in Studio must stay disabled/locked with an explanatory label until content status is Approved.
- Claim "Delete" is a soft-delete (dim + strikethrough, stays visible with an undo path via Active/Inactive), not a destructive removal.
- Sidebar Approvals badge count should reflect a live pending-review count, not a static number.

## Assets
No custom icons or illustration — the system deliberately avoids decorative iconography (type, color, and real photography carry the visual interest). Product/asset thumbnails in the prototype are labeled placeholders; replace with real photography once available.

## Files
- `ContentGate.dc.html` — the full interactive prototype (open in any browser). Covers all 19 routes; use the sidebar nav and row clicks to reach every screen and state described above.
- `screenshots/` — static reference captures of key screens/states: login, dashboard, products list, product detail (overview tab), product edit (claims manager), content ledger, studio (author mode), studio (reviewer mode), approvals, ask, assets, source documents list, source document detail (¶ citations), template ops.
