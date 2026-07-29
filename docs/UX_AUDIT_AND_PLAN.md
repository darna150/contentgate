# ContentGate — UX Audit & Improvement Plan

Audited: 2026-07-29 · Commit `6b2288b` · Branch `main` (clean tree)
Auditor: Claude (design/UX) · Implementer: Codex
Status: **plan only — nothing in this document has been implemented**
Revised: 2026-07-29 — added §4.8/§4.9 deep reviews of Studio and Products; phases restructured to six

---

## 1. Scope & method

**Audited surfaces (code):** all 19 authenticated routes, the app shell, the 15 `ui/*`
primitives, the 13 shared components, and all 10 Studio files.

**Audited live (browser, 1440×900 and 375×812):** login, dashboard, products, content,
approvals, assets, ask, error/empty/loading states. Rendered through the app's built-in
unconfigured-preview fallback (`NEXT_PUBLIC_SUPABASE_URL` unset), which is why counts read
zero in the captures.

**Measured, not estimated:** every contrast ratio below was computed in-page from the
`@theme` token hexes with the WCAG relative-luminance formula. Every count (390 arbitrary
type sizes, 2-of-20 focus styles, 4 duplicated `LANGUAGES` arrays) came from grep or DOM
query, not from reading.

**Not covered.** Studio and the product workspace could not be exercised live — they need
a signed-in session with real data, and I don't enter credentials. Those findings are from
source plus the design oracle in `docs/design/`, and are flagged where confidence is
lower. **Before Phase 2 ships, someone should run the Studio findings against a real
signed-in session.**

**Benchmarks applied:** WCAG 2.1/2.2 AA, Nielsen's heuristics, and the project's own
design oracle (`docs/design/README.md` + `screenshots/`) — the spec this build was
implemented against.

---

## 1b. Decisions already taken

Read this before planning — it resolves the one question that changes the phase order.

- **2026-07-29 — mobile Studio is required.** Confirmed by the product owner. F15 (Studio
  has zero responsive breakpoints) is P0, Phase 2 runs immediately after Phase 1, and the
  `<768px` treatment is a first-class requirement rather than a fallback. This supersedes
  the "prioritize reliable desktop production workflows" line in `PRODUCT_DIRECTION.md`;
  update that file as part of Phase 2.

- **2026-07-29 — Products and Studio get the heavy UI/UX work.** Directed by the product
  owner. §4.8 and §4.9 are the resulting design critiques, and Phases 2 and 3 are scoped as
  redesigns rather than defect repair. Products is promoted above the general navigation
  work.

**Repo state as of Codex's verification pass (2026-07-29):** this audit describes `main` at
`6b2288b`. Remote `main` has since moved to `1536a55` and still carries every Phase 1
defect described here. Branch `codex/fix-redesign-v2-flow` (`92445ff`) contains a partial,
unpublished Phase 1 pass in commit `54a0aff` — the focus ring, skip link and reduced-motion
override are already done there, and its token test passes while omitting the four pairs
that still fail. Start Phase 1 from a clean worktree off `origin/main`, lift the finished
pieces from that branch, and do not treat its green test as coverage.

Questions 2–4 in §7 are still open but none of them block starting.

---

## 2. Verdict

The architecture is genuinely good. The governance model (locked layouts, verbatim
citations, server-enforced approval gating) is coherent, the Studio mode machine
(`studio-mode.ts`) is elegantly small, and `PreviewImage`/`CitationChip` are better than
most production components. **This is not a rebuild. It's a finishing problem.**

Three things hold it back, and they are all systemic rather than cosmetic:

| Area | Grade | One-line summary |
|---|---|---|
| Visual system & tokens | **D** | The accent colour fails contrast at 2.90:1 and is on every primary button and link |
| Accessibility | **D+** | Unlabelled form fields, undesigned focus, silent state changes, false ARIA tabs |
| Studio (core surface) | **C−** | Excellent logic; zero responsive breakpoints, a dead control in the header, reviewer mode inverted, the artifact at 27% |
| Products | **C** | Sound information model, but a kitchen-sink edit page, two generate paths, and a decorative monogram where information belongs |
| Information architecture | **C+** | Knowledge split across three entry points; no global search |
| Feedback & state | **C** | `Toaster` mounted globally, used on 1 of 11 async surfaces |
| Component consistency | **C** | 390 ad-hoc type sizes against 52 uses of the 6-token scale |
| Content design | **B−** | Strong voice, but domain vocabulary is inconsistent |
| Core product logic | **A−** | Governance, citations, fit-checking, mode derivation are all sound |

**The single highest-leverage change:** fix the token layer. `--color-brand: #00aa9f` and
`--color-ink-faint: #a3a3a3` are wrong by 1.6× and 1.9× respectively, and they are
referenced by essentially every screen.

> **Correction (2026-07-29, from Codex's verification pass).** An earlier draft of this
> section claimed the token fix was "~10 file edits… without touching a single component."
> That was wrong. Two of the proposed changes require call-site work:
> `brand-on-tint` needs migrating across **25 combinations in 17 files**, and
> `edge-strong` has **39 uses across 29 files** mixing interactive borders with decorative
> ones (dashed empty states, panels) that must be classified before the token is darkened.
> The functional scope is unchanged and the leverage argument still holds — one token file
> drives the whole system — but budget Phase 1 for a real migration, not a find-and-replace.
> Related: even the corrected `#00807a` on `brand-tint` is only **4.346:1**, which is why
> `brand-on-tint` is mandatory rather than a convenience.

---

## 3. Design thesis

ContentGate's promise is *"approved in, compliant out."* The interface should make
**governance state legible at every moment** — what's locked, what's editable, what's
blocking export, and why.

Today the app *enforces* governance correctly and *communicates* it poorly. The clearest
example: `studio-workspace.tsx` computes a precise, human-readable
`downloadDisabledReason` — "Wait for autosave before downloading the draft preview", "Fix
copy limits before downloading the draft preview" — and then renders it into a `title`
attribute, where it is invisible to touch users, invisible to keyboard users, and requires
a 1-second hover for everyone else. The button just says *"Export — locked until
approved"*, which is often not the actual reason.

**Design principle for this plan: never compute a reason and hide it.** Every gate the
system enforces should be visible, in place, before the user tries the action.

---

## 4. Findings

Severity: **P0** ship-blocking / legal-accessibility risk · **P1** significant user harm ·
**P2** quality and consistency · **P3** polish.

### 4.1 Design tokens & colour — P0

Measured in-browser against the `@theme` block in `src/app/globals.css`.

| Pair | Ratio | Required | Verdict |
|---|---:|---:|---|
| white on `--color-brand` #00aa9f — **every primary button** | **2.90** | 4.5 | ✗ fail |
| `--color-brand` on white — **every link, stat value, ¶ mark** | **2.90** | 4.5 | ✗ fail |
| `--color-brand` on `--color-brand-tint` — secondary button, brand badge | **2.62** | 4.5 | ✗ fail |
| `--color-ink-faint` #a3a3a3 on white — all metadata rows | **2.52** | 4.5 | ✗ fail |
| `--color-ink-faint` on `--color-page` | **2.32** | 4.5 | ✗ fail |
| `--color-sidebar-faint` #595959 on `--color-brand-dark` — "ADMIN", role, workspace type | **2.83** | 4.5 | ✗ fail |
| `--color-approve` on `--color-approve-tint` — **Approved** status pill | **3.98** | 4.5 | ✗ fail |
| `--color-warn` on `--color-warn-tint` — **In review** status pill | **4.28** | 4.5 | ✗ fail |
| `--color-edge-strong` #d4d4d4 on white — **all input borders** | **1.48** | 3.0 | ✗ fail (1.4.11) |
| `--color-ink-muted` #737373 on white | 4.74 | 4.5 | ✓ pass |
| `--color-ink-muted` on `--color-page` | 4.35 | 4.5 | ✗ marginal fail |
| `--color-reject` on `--color-reject-tint` | 5.79 | 4.5 | ✓ pass |

**F1 · The accent is unusable as text or as a button ground.** #00aa9f at 2.90:1 fails
normal text (4.5:1), large text (3:1), and non-text UI contrast (3:1). It is the fill of
`Button variant="default"` with white text, and the colour of every link in the app.

**F2 · `ink-faint` is decorative, not readable.** At 2.32–2.52:1 it carries genuinely
important information: owner names, timestamps, paragraph counts, `1080×1080` dimensions
on size pills, the entire meta line of every list row.

**F3 · Status pills — the app's core signal — fail.** Approved and In review both land
under 4.5:1. Governance state is the one thing that must never be ambiguous.

**F4 · Input borders are effectively invisible** at 1.48:1, failing WCAG 1.4.11. Fields
read as flat rectangles rather than controls.

**F5 · The "positive" attention banner has an invisible accent rail.** In
`dashboard-summary-panel.tsx`, `TONE_STYLES.positive` is
`"border-approve-tint bg-approve-tint/40"` — the `border-l-4` rail is the same hue as its
own fill. Confirmed visually: the "You're all caught up" banner renders as a floating
tinted block with no left rail, breaking the pattern the `warn` and `info` tones establish.

**Fix.** Re-derive the failing values. Keep every token *name* — that's what makes this cheap.
Suggested targets, all verified ≥4.5:1 where used as text:

```css
--color-brand:          #00807a;  /* 4.81:1 on white — links, primary button ground */
--color-brand-strong:   #006b66;  /* NEW — hover/pressed for primary */
--color-brand-tint:     #e6f7f5;  /* unchanged — fill only, never a text ground for brand */
--color-brand-on-tint:  #00635e;  /* NEW — 6.44:1 on brand-tint; the only teal allowed there */
--color-approve:        #00706a;  /* 5.39:1 on approve-tint */
--color-warn:           #86560f;  /* 5.69:1 on warn-tint */
--color-ink-faint:      #6b6b6b;  /* 5.33:1 on surface, 4.89:1 on page */
--color-ink-muted:      #5c5c5c;  /* 6.14:1 on page — clears AA on both grounds, not just surface */
--color-edge-strong:    #8a8a8a;  /* 3.45:1 on surface, 3.17:1 on page — input borders (1.4.11) */
--color-sidebar-faint:  #8a8a8a;  /* 5.73:1 on #0a0a0a */
```

Every ratio above was computed against the intended ground, not assumed. Note
`--color-edge-strong` needs to clear 3:1 on **both** `surface` and `page`, since inputs
appear on both — that constraint is what rules out anything lighter than roughly `#949494`.

> Codex: re-verify after any adjustment — don't trust these blind. Add a unit test
> (`src/lib/design-tokens.test.ts`) that parses `globals.css` and asserts every documented
> foreground/background pair clears its threshold. That converts a style opinion into a CI
> gate, which is the only way it stays fixed.

**F6 · Elevation and border tokens are decorative-only by design, and that's fine** —
`--color-edge` at 1.26:1 is acceptable for card boundaries (decorative), but must not be
used on controls.

### 4.2 Accessibility — P0/P1

**F7 · Form labels are not associated with their inputs. (P0, WCAG 1.3.1 + 4.1.2)**
`src/app/(app)/products/new/page.tsx` and `src/app/(app)/products/[id]/edit/page.tsx`
contain six `<label>` elements that neither carry `htmlFor` nor wrap their control. A
screen reader announces these fields with no accessible name. Repo-wide there are 14
`htmlFor` attributes against far more labels; `knowledge/new/add-document-form.tsx`
gets it right by wrapping — follow that or use the `Label`/`Input` primitives.

**F8 · Focus is undesigned. (P1)** Of 20 focusable elements on `/content`, **2** carry
explicit focus styling (`Button`'s cva ring and a native `<select>`). Sidebar nav, product
cards, content rows, filter chips, Studio size pills, background swatches, citation chips
and workspace tabs all fall back to the user agent's ring. It *is* visible (verified by
tabbing — Chrome draws its amber/black ring), so this is not a 2.4.7 failure, but it is
inconsistent across browsers and visually foreign to a near-monochrome system. Define one
ring in `globals.css` and apply it via a shared `focusRing` class.

**F9 · No skip link; `<main>` has no `id`. (P1, WCAG 2.4.1)** Every route puts 12+ nav
stops ahead of page content. Keyboard and screen-reader users traverse the full sidebar on
every navigation.

**F10 · False ARIA tabs. (P1)** `components/filter-chips.tsx` and
`products/[id]/_workspace/workspace-tabs.tsx` apply `role="tablist"`, `role="tab"` and
`aria-selected` to `<a>` elements with no `tabpanel`, no `aria-controls`, and no
arrow-key roving focus. Assistive tech announces a tab widget and promises interactions
that don't exist. These are navigation links: use `<nav>` + `aria-current="page"` and drop
the tab roles entirely.

**F11 · Studio's state changes are silent to assistive tech. (P1)** The autosave chip
("Saving… / ✓ Draft saved / Save failed"), the overflow advisory, the truncation warning
and every generation error render without `aria-live`. `GenerationLoader` does it right
(`role="status" aria-live="polite"`) — extend that to the save-state region and errors.

**F12 · Inputs at 13px trigger iOS zoom-on-focus. (P2)** `ui/input.tsx`, `ui/textarea.tsx`
and `ui/select.tsx` all set `text-[13px]`; Safari auto-zooms below 16px. Studio's field
textareas already override to `text-[16px]` — someone knew — but login, product edit,
knowledge upload, asset metadata and the Ask composer (13.5px, measured) do not.

**F13 · `title` is load-bearing. (P2)** Studio's export blocker, the "Not generated yet"
size hint, and the refine chips' instruction text are only available on hover. Not
reachable by touch or keyboard.

**F14 · Motion guards are partial. (P3)** Three `motion-reduce:` guards exist. `Skeleton`
(`animate-pulse`), `PreviewImage`'s loading pulse and `BrandLoader` (`animate-spin`) run
unguarded. Add a global `@media (prefers-reduced-motion: reduce)` block.

### 4.3 Studio — P0/P1

Studio is the product. It's also the least finished surface.

**F15 · Studio has zero responsive breakpoints. (P0)** Grepping all 10 files in
`src/app/(app)/studio/` returns **0** occurrences of `sm:`, `md:`, `lg:` or `xl:`.

```tsx
// studio-workspace.tsx:716
<div className="flex h-screen min-h-[720px] flex-col overflow-hidden bg-page">
// studio-workspace.tsx:755  — inline style, no media query
style={{ gridTemplateColumns: "minmax(360px, 400px) minmax(0, 1fr)" }}
```

Consequences: at 768px the editor takes 400px and the canvas gets 368px. At 390px the
editor's 360px minimum leaves ~30px of canvas. `h-screen` sits *inside* a mobile layout
that already renders a 64px sticky header, so the page overflows by exactly that. And
`min-h-[720px]` combined with `overflow-hidden` clips content unreachably in phone
landscape. Meanwhile Ask has a proper `lg:` breakpoint and a mobile drawer — Studio is the
outlier, on the one surface that matters most.

**F16 · The export blocker is computed then hidden. (P1)** See §3. `downloadDisabledReason`
carries four distinct, actionable states into a `title` attribute. Promote it to a visible
line in the export bar.

**F17 · The left column has no hierarchy. (P1)** Nine unrelated blocks stack in one 400px
scroll with uniform `gap-7` and no headings, dividers or grouping: generate panel →
background picker → copy fields → manual-edit warning → rejection note → save chip →
Submit → Copy-copy button → versions. The primary action (**Submit for review**) sits
mid-scroll, below advisory text, above a secondary utility button. On a 5-field template
it falls below the fold. Group into three labelled zones — *Generate* / *Edit* / *Ship* —
and dock the Ship zone to the bottom of the column.

**F18 · Per-size draft status is computed and thrown away. (P2)** `StudioToolbar` receives
a `sizeStatus(key)` function returning `empty | draft | in_review | approved` and uses it
only for `title={status === "empty" ? "Not generated yet" : undefined}`. The `SizeChip`
component with exactly the right status dot exists and is already used in the product
Templates tab. Studio's toolbar imports only its *type*. Render the dot: "which sizes are
done" is the single most useful thing a multi-size authoring tool can show.

**F19 · Native `window.confirm` for discard-unsaved-edits. (P2)**
`studio-workspace.tsx:350` — while `components/confirm-dialog.tsx` exists and is used by
the Ask notebook. Fires on every size switch.

**F20 · Two generation entry points with divergent UI. (P2)** `StudioGeneratePanel` uses
the design-system `Select`/`Button`, nine refine chips and a five-message loader.
`products/[id]/generate-variant.tsx` uses raw `<select>`/`<button>` with hand-rolled
classes, a *different* four-message loader, no refine options, and a missing `aria-label`
on its language select. Same action, two products.

**F21 · No canvas controls. (P3)** No zoom, no fit-to-width, no 1:1, no pixel-ratio
readout. Scale is automatic only — a reviewer can't inspect a 728×90 leaderboard's
kerning.

**F22 · No keyboard shortcuts. (P3)** ⌘S (force save), ⌘↵ (generate), ←/→ (size), ⌘⇧E
(export) are all natural here and all absent.

### 4.4 Information architecture — P1

**F23 · Knowledge lives in three places under two names.** "Ask" (core nav), "Source
Documents" (admin nav), and a per-product "Knowledge" tab — plus "Approved claims" inside
product edit. Same domain, four vocabularies, split across two nav sections by *role*
rather than by *task*. Users who can't see the admin section have no path from an answer
to its source list.

**F24 · No global search, and no per-list search except Assets.** Content, Approvals,
Products and Source Documents offer filters but no free-text search. For a content library
whose value proposition is retrieval, this is the largest functional gap in the app. A ⌘K
palette spanning products, content, documents and templates would also solve F23's
navigation problem.

**F25 · No breadcrumbs; back-links lie.** Studio's header always links to `/content`, even
when the user arrived from `/products/[id]?view=templates`. The product workspace uses a
text-arrow back link rather than a breadcrumb, so at `?view=approvals` there's no
indication of depth.

**F26 · The dashboard optimises for greeting, not work.** The largest element on the page
is "Good afternoon, {name}." Three stat tiles then consume the fold. At 375px you scroll
~700px past three near-empty cards before reaching Recent activity. Nothing on the page is
searchable, and the only actionable element is one "Review now →" link.

**F27 · Legacy review surface still exists. (P3)** `content/[id]/page.tsx` (342 lines)
`permanentRedirect`s to Studio for platform content but remains a parallel review UI for
legacy rows. Debt, not a live defect.

### 4.5 Feedback, state & errors — P1

**F28 · The global toast channel is used once.** `<Toaster />` is mounted in
`(app)/layout.tsx`; `toast()` is called in exactly one file
(`settings/invite-form.tsx`). Ten other async surfaces — Studio generate/save/submit/
export, Ask, asset upload/edit/delete, template ops, approvals — each hand-roll `setError`
plus a bespoke inline error element with its own colour, size and placement. Pick one
model: toasts for transient outcomes, inline for field-bound validation, and apply it
everywhere.

**F29 · Loading jumps.** `(app)/loading.tsx` centres a spinner in `h-[60vh]`; content then
renders top-aligned. Every navigation produces a visible jump. Route-level skeletons that
mirror the destination layout would remove it.

**F30 · Empty states are inconsistent and sometimes dead-end.** Two systems (`EmptyState`
and `_workspace/empty-state.tsx`); Assets passes an icon, Content/Products/Approvals
don't; the Products empty state for non-admins offers no next step at all ("Products are
set up during onboarding" — by whom? contacted how?).

**F31 · Error copy has no recovery path.** "Generation failed. Try again." appears for
rate limits, grounding failures, network errors and provider outages alike. The API
already returns structured reasons — surface them.

### 4.6 Mobile — P1

**F32 · The Ask notebook doesn't fill the viewport on mobile.** Verified at 375×812: the
composer lands mid-screen with a large empty band beneath it. Cause: `ask/page.tsx` uses
`flex h-full flex-col`, but `(app)/layout.tsx` gives `<main className="min-w-0 flex-1">`
no definite height — under the mobile `flex-col` layout `height: 100%` is indeterminate
and collapses to `auto`. It works on desktop only because the `h-screen` sidebar makes the
flex row definite. Fix at the layout level (`min-h-0` + `h-dvh` chain), not in Ask.

**F33 · Two hamburgers on one mobile screen.** The app shell's nav toggle and the Ask
notebook's sessions-drawer toggle, stacked vertically, identical glyph, different targets.

**F34 · `h-screen` should be `h-dvh`.** Mobile browser chrome makes `100vh` wrong on
iOS/Android. Affects Studio and the sidebar.

**F35 · The mobile nav toggle is 36×36.** Passes WCAG 2.2 AA (24×24) but below the 44px
comfort target for the sole navigation control on the smallest viewport.

### 4.7 Consistency & content design — P2

**F36 · The type scale is defined and then bypassed.** `globals.css` defines six named
sizes. Usage across the codebase:

- **390** arbitrary `text-[Npx]` utilities spanning **19** distinct values
  (9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 16, 17, 18, 22, 30, 34, 44px)
- **52** uses of the named scale (`text-label` 22, `text-h1` 11, `text-body` 10,
  `text-h2` 5, `text-caption` 4, `text-display` 0)

That's 88% off-system. The dashboard heading is `text-[30px]` where `PageHeader` uses
`text-h1` (28px) — the same semantic level, two sizes.

**F37 · Colours hardcoded outside the token layer.** `citation.tsx` uses `bg-[#fafafa]`;
`studio-background-picker.tsx` uses six raw hexes; `studio-generate-panel.tsx` uses
Tailwind's stock `bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300` — a
foreign palette *and* a `dark:` variant in an app with no dark mode.

**F38 · `LANGUAGES` is duplicated in four files** — `studio-generate-panel.tsx`,
`generate-variant.tsx`, `content/page.tsx`, `approvals/page.tsx`. Adding a locale means
four edits and one of them (`generate-variant`) is already missing the display labels the
others have.

**F39 · Domain vocabulary drifts.** "Ask" / "Source Documents" / "Knowledge" / "Approved
claims" for one domain. "Brand reference" / "original" / "reference asset" for one
concept. "Refine" / "revision" / "adaptation" for one action. Write a short glossary and
enforce it.

**F40 · Copy nits.** "Copy generated copy" (button label). "Layout over" and "needs edit"
in the fit indicator are internal jargon. "Export — locked until approved" overstates when
the real blocker is unsaved autosave.

---

## 4.8 Deep review — Studio

Added 2026-07-29 at the product owner's request. §4.3 catalogued Studio's *defects*; this
section is a design critique of the surface itself. Findings here are the reason Phase 2
is a redesign rather than a repair.

**F41 · "Preview as reviewer" is a dead control that looks live. (P1)**

```tsx
// studio-workspace.tsx:742
{canReview && content ? (
  <span className="shrink-0 text-[14px] font-bold text-brand">
    {mode === "review" ? "Reviewer view" : "Preview as reviewer"}
  </span>
) : ( … )}
```

A bare `<span>` with no handler, styled `text-brand` bold 14px — visually identical to
every real link in the app. `docs/design/README.md` specifies it as a toggle
("'Preview as reviewer' / 'Exit reviewer view' toggle"). Two consequences: reviewers will
click it and nothing happens, and **reviewer mode can never be entered deliberately** —
`resolveStudioMode` derives it from status plus permission only. An author cannot preview
how their draft will look to a reviewer, and a reviewer cannot step back to the author
view to understand what was edited.

**F42 · Reviewer mode inverts the task order. (P1)**

The reviewer's job is read → judge → act. The build renders act → read. In `mode ===
"review"` the editor column stacks:

1. `StudioReviewActions` — **Approve / Reject, at the top, before any content is shown**
2. The background picker, disabled and dimmed to 55% opacity — unusable noise
3. Read-only copy fields — the thing they actually came to evaluate
4. "Awaiting your review. Editing is paused…" — restating what the disabled controls say
5. A disabled "Copy generated copy" button
6. Versions

The design oracle's reviewer screen is the inverse and much better: a `REVIEWING DRAFT`
eyebrow, then Language / Headline / Subhead as a read-only summary, then the comment box,
then Approve / Reject. One column, one job, in task order. Rebuild reviewer mode as its
own composition rather than the author column with controls switched off.

**F43 · The artifact under review renders at 27%. (P1)**

Derived from the source dimensions at a 1440×900 viewport (arithmetic, not measured in
app — verify during implementation):

```text
1440 − 248 sidebar                        = 1192 studio width
1192 − 400 editor column                  =  792 canvas column
 900 −  76 header                         =  824 canvas column height
 824 − 173 toolbar − 85 export bar         =  566 canvas region
 566 −  48 padding = 518 usable height ·  792 − 48 = 744 usable width

story     1080×1920 → scale 0.270 → 291×518   ← 27%
square    1080×1080 → scale 0.480 → 518×518
link-ad   1200× 628 → scale 0.620 → 744×389
leaderboard 728× 90 → scale 1.000 → 728× 90
```

Chrome consumes **258 of 824px — 31% of the canvas column's height**. Story is a primary
social format and it renders as a 291px-wide thumbnail. In a product whose entire promise
is that output is on-brand, the reviewer cannot judge type, spacing or crop at that scale.
This is the strongest argument for adding zoom/fit controls (F21) and for reclaiming
toolbar height (F44) — treat those two as one piece of work.

**F44 · The size switcher costs 173px of vertical space. (P2)**

`px-10 py-7` container + two-line pills (`min-w-[92px] px-4 py-2`, label over dimensions)
+ `gap-5` + a `py-3` segmented toggle. That is a fifth of the viewport height spent on a
five-item switcher and a two-item toggle. Collapse to a single row of compact pills with
the dimensions in a tooltip or on the active pill only, and dock the draft/reference
toggle inline with it rather than on its own line.

**F45 · The background picker is in the wrong column. (P2)**

It changes what the canvas looks like but lives in the text-editing column, between the
generate panel and the copy fields — so the user's eye must travel across the split to see
the effect of a swatch click. It also renders in `review` and `read` modes as a dimmed,
disabled control with a "Locked" badge, where it is pure noise. Move it adjacent to the
canvas and hide it entirely when not editable.

**F46 · The Approve button fails contrast. (P2)** White on `--color-approve` `#00877e` is
**4.41:1**. This is the single most consequential control in a governance product. Phase 1's
`approve: #00706a` lifts it to **5.96:1** — no separate work needed, but verify it.

**F47 · Two export paths in two places. (P2)** The export bar, and a "Copy generated copy"
button in the editor column that also `POST`s to `/api/export/[id]` and is gated by the
same `exportAllowed` rule. Same governance boundary, two affordances, different placement,
one of them with an awkward label (F40).

**F48 · The versions panel is effectively hidden. (P3)** Renders only when
`versions.length > 1`, at the very bottom of the editor scroll — below nine other blocks.
In a workflow that generates, rejects and regenerates, version history is a primary
affordance, not a footer.

---

## 4.9 Deep review — Products

**F49 · `/products/[id]/edit` is a kitchen sink. (P1)** One route holds four unrelated
concerns: the product details form, the approved-claims manager, `ProductAssetPanel`, and
a danger zone with archive. Claims are *content*, not settings — editing one means leaving
the workspace for a settings page, and both claims and assets already exist as read-only
views in the workspace tabs. Split it: claims and assets become editable in place in their
own tabs; `/edit` keeps only details plus the danger zone.

**F50 · Two generation entry points, and the weaker one is the default path. (P1)** The
Templates tab renders `GenerateVariant` — two raw `<select>` elements and a hand-styled
`<button>`, no refine options, its own loader copy, and a missing `aria-label` on the
language select. Studio's create mode offers the design-system `Select`, nine refine chips
and a richer loader. **Generating from the tab immediately `router.push`es to Studio
anyway** — so the product page ships a lower-capability duplicate of the screen it is about
to send you to. Replace it with a single "Generate" affordance that opens Studio in create
mode with the size preselected.

**F51 · The product card's monogram is decorative and the spec's alternative doesn't
exist. (P2)** `docs/design/README.md` calls for a teal category eyebrow (PACKS,
OUTERWEAR…). `products` has **no category column** — `category` lives on
`product_templates`. So the spec assumed a field the data model never had, and the build
filled the slot with a first-letter tile that carries zero information *and* contradicts
the oracle's own rule ("No custom icons or illustration — the system deliberately avoids
decorative iconography"). Decide deliberately: add a real category/segment field, or put
genuine information in that slot (last activity, in-review count) and drop the monogram.

**F52 · The card footer surfaces a deprecated metric and omits a useful one. (P2)** Cards
show "N approved claims · N templates". The product is actively moving away from
hand-maintained claims — `products/[id]/edit` says so in its own copy: generation "scans
those documents for source-bound answers instead of asking admins to maintain claims by
hand." Meanwhile content count, which the reference card shows, is absent.

**F53 · No search, sort or status filter on `/products`. (P2)** `status` is
active/archived/inactive, yet archived products sit in the same grid distinguished only by
a badge. At more than ~12 products the page becomes unusable, and there is no way to hide
archived.

**F54 · Tab switching flashes and jumps. (P2)** Each workspace tab is a `<Link href="?view=…">`
server navigation, so every switch triggers the route-level `loading.tsx` — a spinner
centred in `h-[60vh]` — then renders content top-aligned. `scroll={false}` prevents the
scroll reset but not the flash. A "workspace" should switch tabs instantly; this is the
clearest place where F29's skeleton work pays off.

**F55 · Product Overview is visually indistinguishable from the global Dashboard. (P2)**
Both render `DashboardSummaryPanel` unchanged: same banner, same three stat tiles, same
activity list. Two different scopes, one appearance — users lose track of whether they are
looking at the workspace or one product. The panel's `scope` parameter exists in the spec
for exactly this reason; give the product scope its own treatment.

**F56 · Two asset UIs. (P3)** `ProductAssetPanel` (128 lines) in the workspace and edit
page, `AssetLibrary` (177 lines) at `/assets`. Same domain, two components, divergent
interaction models.

**Worth preserving.** `getAttentionItem` in `overview-view.tsx` is the best piece of
product thinking in the workspace — a real priority ladder (archived → awaiting review →
no template → no knowledge → no assets → no content → caught up) that always tells the
user the single most useful next step. Do not flatten it during the redesign. Its only
problem is the invisible banner rail (F5).

---

## 5. The plan

Six phases. Each is independently shippable and independently revertable. Phases 1–3 carry
the overwhelming majority of the value; Phases 2 and 3 are the heavy UI/UX work on Studio
and Products the product owner asked for, and they are redesigns rather than repairs.

### Phase 1 — Token & accessibility foundation `≈2 days`

*Highest leverage in the whole plan: ~10 file edits, hundreds of call sites corrected.*

1. Re-derive the failing hexes in `src/app/globals.css` (§4.1). Names unchanged. Add
   `--color-brand-strong` and `--color-brand-on-tint`.
2. Add `src/lib/design-tokens.test.ts` asserting every documented pair clears its
   threshold. Wire into `npm test`.
3. Fix `TONE_STYLES.positive` in `dashboard-summary-panel.tsx` (F5) — use
   `border-l-approve` against the tinted fill so all three tones share one rail pattern.
4. Define one focus ring in `globals.css`; apply to nav links, cards, list rows, filter
   chips, size pills, swatches, citation chips (F8).
5. Add a skip-to-content link and `id="main"` in `(app)/layout.tsx` (F9).
6. Associate the six orphaned labels in `products/new` and `products/[id]/edit` — prefer
   swapping to the `Label`/`Input`/`Textarea` primitives (F7).
7. Raise `ui/input|textarea|select` base to `text-[16px]` on `< md`, 13–14px above (F12).
8. Drop `role="tablist"`/`role="tab"` from `filter-chips.tsx` and `workspace-tabs.tsx`;
   use `<nav>` + `aria-current="page"` (F10).
9. Add a global `prefers-reduced-motion` block (F14).

**Acceptance:** token test green; axe-core clean on `/dashboard`, `/content`,
`/products/new`, `/assets`; tab traversal from page load reaches main content in ≤2 stops;
every focusable element shows the system ring.

### Phase 2 — Studio `≈5 days`

*The core surface, and — now that mobile Studio is confirmed required — the phase that
carries the most product risk. Do not start before Phase 1 lands; half of these touch the
same files.*

0. **Fix the layout height chain first (F32 / F34).** In `(app)/layout.tsx` the flex
   column gives `<main className="min-w-0 flex-1">` no definite height, so a child's
   `h-full` is indeterminate and collapses to `auto` on mobile. This already breaks Ask
   (composer lands mid-screen with a dead band beneath it, reproduced at 375×812) and it
   will break any mobile Studio layout built on top of it. Add `min-h-0` to the flex
   children and move the shell to `h-dvh`. **Prerequisite for step 1 — do not skip it and
   work around it inside Studio.**
1. **Responsive Studio (F15).** Replace the inline grid with a breakpoint-aware layout.
   Mobile is a first-class target here, not graceful degradation:
   - `≥1280px` — current two-column (editor 400px / canvas fluid)
   - `1024–1279px` — editor 340px, canvas fluid
   - `768–1023px` — stacked: canvas on top (60vh), editor below, export bar sticky
   - `<768px` — canvas full-width with a sticky bottom sheet for the editor; size
     switcher and the Ship zone reachable without dismissing the sheet
   Swap `h-screen` → `h-dvh`, drop `min-h-[720px]`, make `px-10` responsive. Account for
   the 64px mobile header the shell already renders — that overflow is why `h-screen` is
   wrong here specifically, not just as general mobile hygiene.
2. **Surface the export blocker (F16).** Render `downloadDisabledReason` as a visible line
   above the export button, with an icon keyed to the blocker type. Remove reliance on
   `title`.
3. **Restructure the editor column (F17).** Three labelled zones — *Generate* / *Edit* /
   *Ship* — with the Ship zone (save state + Submit + export readiness) docked to the
   bottom of the scroll container so the primary action is always reachable.
4. **Render size status (F18).** Use `SizeChip`'s dot in `StudioToolbar` so completed
   sizes are visible at a glance. Delete the `title`-only fallback.
5. **Replace `window.confirm` with `ConfirmDialog` (F19).** Only prompt when edits would
   actually be lost.
6. **Add `aria-live` to save state, overflow advisory and errors (F11).**
7. **Unify the two generate surfaces (F20).** Extract one `<GenerateControls>` used by
   both Studio and the product Templates tab; one loader component; one `LANGUAGES`
   constant in `src/lib/languages.ts` (F38).
8. **Make reviewer mode its own composition (F41 / F42).** Two pieces:
   - Make "Preview as reviewer" a real toggle. It is currently a `<span>` styled to look
     exactly like a link. Either wire it, or remove the styling — a dead control that
     looks live is worse than no control.
   - Rebuild the review column in task order: `REVIEWING DRAFT` eyebrow → read-only
     field summary → comment box → Approve / Reject. Do not render the author column with
     controls switched off. Drop the disabled background picker, the redundant "editing is
     paused" note and the disabled Copy button from this mode entirely.
9. **Give the canvas back its space (F43 / F44 / F21).** Treat as one piece of work:
   collapse the toolbar to a single compact row with the draft/reference toggle docked
   inline; add zoom / fit-width / 1:1 controls with the current scale shown. Target: a
   1080×1920 story readable above 50% on a 1440×900 screen, up from 27% today.
10. **Move the background picker next to the canvas, and hide it when not editable
    (F45).**
11. **Collapse the two export paths (F47)** — fold "Copy generated copy" into the export
    bar as a format option rather than a separate button in the editor column.
12. **Keyboard shortcuts (F22)** with a `?` overlay listing them. Desktop only — don't let
    this displace mobile work.
13. **Mobile Studio E2E coverage.** Extend
   `tests/e2e/contentgate-generation.spec.ts` with a 390×844 project that runs the full
   loop: generate → edit a field → switch size → submit → approve → export. The existing
   suite is desktop-viewport only, so nothing currently guards the layout you're about to
   build.

**Acceptance:** the full generate → edit → submit → approve → export loop completes at
**390×844** as well as 768 / 1024 / 1440, with no clipped canvas, no horizontal body
scroll, and no content trapped behind `overflow-hidden`; blocker reason visible without
hover; Submit reachable without scrolling on a 5-field template; a 1080×1920 story
readable above 50% at 1440×900; reviewer mode shows content before actions; no dead
controls in the header; VoiceOver announces save transitions. Ask also fills the viewport
at 375×812 (falls out of step 0).

### Phase 3 — Products `≈4 days`

*Promoted above the general navigation work at the product owner's request. Depends on
Phase 2 only for the unified generate control (step 2).*

1. **Decompose `/products/[id]/edit` (F49).** Claims and assets become editable in place
   in their own workspace tabs; `/edit` keeps product details plus the danger zone. This
   removes the "leave the workspace to manage content" detour and the duplicate read-only
   views.
2. **One generation entry point (F50).** Delete `GenerateVariant`'s inline form. The
   Templates tab gets a single Generate affordance that opens Studio in create mode with
   the size preselected — Studio is where it lands anyway. Reuses the `<GenerateControls>`
   extracted in Phase 2 step 7.
3. **Rebuild the product card (F51 / F52).** Decide the monogram question deliberately —
   add a real category/segment field, or put genuine information in that slot. Swap the
   deprecated "approved claims" count for content count plus status. Keep the count row;
   it's useful, it's just showing the wrong numbers.
4. **Add search, sort and a status filter to `/products` (F53)**, with archived hidden by
   default behind a filter chip.
5. **Make tab switching instant (F54).** Route-level skeletons matching each tab's layout,
   or client-side view state — either is fine, but the flash-and-jump has to go.
6. **Differentiate product Overview from the global Dashboard (F55).** Use the `scope`
   parameter the spec already defines; product scope should read as a product, not as a
   second dashboard. Preserve `getAttentionItem`'s priority ladder exactly — it is the best
   thing in the workspace.
7. **Converge the two asset UIs (F56)** on one component with a `compact` variant.

**Acceptance:** claims and assets editable without leaving the workspace; one generate
affordance; `/products` usable at 50+ products with archived hidden by default; tab
switching produces no spinner flash or layout jump; product Overview visually distinct
from `/dashboard` at a glance.

### Phase 4 — Navigation & findability `≈3 days`

1. **⌘K command palette (F24)** over products, content, documents, templates and
   navigation. Single highest-value new feature in this plan.
2. **Free-text search on Content, Approvals and Source Documents** (server-side, reusing
   the existing cursor pagination).
3. **Merge the knowledge entry points (F23).** One "Knowledge" section containing Ask and
   Source Documents, with the admin-only surface gated inside it rather than in a separate
   nav group.
4. **Breadcrumbs (F25)**, and make Studio's back-link honour the referring context.
5. **Rebuild the dashboard around work, not greeting (F26).** Demote the greeting to a
   caption; lead with the approval queue and in-flight drafts; make the stat tiles compact
   and filterable.

**Acceptance:** any product/content/document reachable in ≤2 keystrokes + query; every
list searchable; breadcrumbs on all nested routes.

### Phase 5 — Feedback & state `≈2 days`

1. **Adopt one feedback model (F28).** Toasts for transient outcomes; inline for
   field-bound validation. Migrate all ten hand-rolled `setError` surfaces.
2. **Route-level skeletons matching destination layout (F29)**; delete the centred spinner.
3. **Consolidate the two empty-state systems; give every empty state an action (F30).**
4. **Map API error codes to specific, recoverable messages (F31).**

**Acceptance:** no bespoke inline error styling outside form fields; no layout jump on
navigation; every empty state has a next step.

### Phase 6 — Consistency & polish `≈3 days`

1. **Migrate the 390 arbitrary type sizes onto the named scale (F36).** Extend the scale
   to ~9 steps first so the migration doesn't force bad rounding. Add an ESLint rule
   banning `text-[Npx]` afterwards — otherwise it regresses within a month.
2. **Move the remaining hardcoded hexes into tokens (F37).**
3. **Write the vocabulary glossary and apply it (F39, F40).**
4. **Implement the motion spec** from `docs/design/README.md` —
   `cubic-bezier(0.16, 1, 0.3, 1)`, page-entrance fade+rise — behind the reduced-motion
   guard.
5. **Remaining mobile polish:** resolve the double hamburger on Ask (F33) and raise the
   nav toggle to 44px (F35). The height chain and `h-dvh` (F32/F34) already landed in
   Phase 2 step 0.
6. **Retire the legacy `/content/[id]` review UI (F27)** once legacy rows are migrated.

**Acceptance:** ≤20 arbitrary type sizes remain (all deliberate); ESLint guard active; no
raw hex outside `globals.css`; mobile Ask fills the viewport.

---

## 6. What not to do

- **Don't rebuild the template platform, the renderer, or the governance model.** They're
  the strongest part of the codebase. Every finding here is presentational or
  navigational.
- **Don't introduce a second design system or a component library.** The tokens are
  well-named; the problem is their *values* and their *adoption*, not their structure.
- **Don't rename tokens.** Changing hexes is a 1-file diff; renaming is a 200-file diff for
  zero user benefit.
- **Don't add dark mode yet.** There's no product demand signal, and `globals.css` has no
  dark token set. Remove the stray `dark:` variants in
  `studio-generate-panel.tsx` rather than building around them.
- **Don't chase the design oracle pixel-for-pixel where it conflicts with accessibility.**
  `docs/design/README.md` specifies `#00AA9F` and `#A3A3A3` directly. Those specific values
  are the source of the P0 contrast failures. Keep the oracle's *system* — near-monochrome,
  one functional accent, Inter, hairline borders — and correct its hexes.

---

## 7. Open questions

1. ~~**Is mobile Studio actually required?**~~ — **ANSWERED 2026-07-29: yes, mobile Studio
   is required.** F15 is confirmed P0, and Phase 2 runs immediately after Phase 1. Three
   consequences, all folded into the plan above: the `<768px` treatment in Phase 2 step 1
   is a first-class requirement rather than graceful degradation; the layout height-chain
   fix (F32/F34) moves *into* Phase 2 as a prerequisite, because Studio sits in the same
   `(app)/layout.tsx` whose broken `h-full` chain already breaks Ask on mobile; and mobile
   Studio needs its own E2E coverage at a 390×844 viewport. This also supersedes the
   "prioritize reliable desktop production workflows" line in `PRODUCT_DIRECTION.md` —
   update that doc so the next reader doesn't re-derive the old answer.
2. **Who are the personas by volume?** Admin (template ops, source docs) vs local marketer
   (generate, edit, export) vs reviewer (approve/reject). The nav currently splits by role
   permission rather than by task frequency; knowing the ratio would settle F23 and F26.
3. **Does the design oracle stay authoritative?** If yes, it needs a revision with
   corrected hexes so the next implementer doesn't reintroduce the failures.
4. **Is a 2026 accessibility conformance statement (VPAT/EAA) in scope?** If ContentGate
   sells into EU or public-sector accounts, Phase 1 is a compliance dependency, not a
   quality improvement.

---

## Appendix — evidence index

| Finding | Verified by |
|---|---|
| Contrast ratios (F1–F6) | In-page WCAG luminance computation over `@theme` hexes |
| Focus coverage (F8) | DOM query on `/content`: 2 of 20 focusable elements with explicit focus classes |
| Skip link / landmarks (F9) | DOM query: `hasSkipLink: false`, `main` id `(none)` |
| Studio responsive gap (F15) | `grep -c "sm:\|md:\|lg:\|xl:"` across all 10 Studio files → 0 |
| Type-scale drift (F36) | 390 `text-[Npx]` occurrences, 19 distinct values, vs 52 named-scale uses |
| Toast adoption (F28) | `toast(` appears in 1 file; `setError` in 10 |
| `LANGUAGES` duplication (F38) | 4 declarations |
| Size status discarded (F18) | `studio-toolbar.tsx` imports only `type SizeChipStatus` |
| Positive banner rail (F5) | Visual capture at 1440×900 + `TONE_STYLES` source |
| Mobile Ask dead space (F32) | Visual capture at 375×812 |
| Label association (F7) | `grep "<label"` vs `htmlFor` in `products/new`, `products/[id]/edit` |
| Dead reviewer toggle (F41) | `studio-workspace.tsx:742` — bare `<span>`, no handler, `text-brand` bold |
| Canvas at 27% (F43) | Arithmetic from fixed source dimensions at 1440×900 — verify in app |
| Approve button 4.41:1 (F46) | WCAG computation, white on `--color-approve` #00877e |
| No `category` on products (F51) | `products` select in `product-workspace-server.ts:287`; `category` exists only on `product_templates` |
| Two generate paths (F50) | `generate-variant.tsx` raw controls vs `studio-generate-panel.tsx` |
| Kitchen-sink edit page (F49) | `products/[id]/edit/page.tsx` — details form, claims, `ProductAssetPanel`, danger zone in one route |
| Two asset UIs (F56) | `product-asset-panel.tsx` 128 lines vs `asset-library.tsx` 177 lines |
