# ContentGate Studio pilot audit — 2026-08-01

## Decision

**NO-GO for an external pilot on the audited candidate.**

The Studio's finite UI surface is broadly functional, but three pilot-critical boundaries are not reliable enough to put in front of a design partner:

1. seven of the nine visible refinement directions fail their first request; and
2. autosave does not give a dependable failure/conflict signal for stale-tab, offline, and rapid-edit races; and
3. the product-variant picker does not expose its selected state to assistive technology.

This audit did not change product code. It created a staging-only automated QA harness, disposable staging identities, evidence files, and this report.

## Frozen candidate

- Branch: `codex/complete-build-source-of-truth`
- Commit: `2f11c6b575536fc323e742b66d2a916594153b6d`
- Preview: `https://contentgate-git-codex-complete-681f3e-debbies-projects-a8de6bb4.vercel.app`
- Supabase: staging project `bncwjibscptgijgmuhrn`
- Fixture: Nimbus 1 / Nimbus Air Campaign / `figma-full-v9-stable-assets`
- Production: not accessed or mutated
- Disposable QA users and content: removed after each run

## What “exhaustive” means here

Infinite free-text and timing combinations cannot literally be enumerated. This audit therefore covered:

- every finite Studio control and active format;
- every state in the author/reviewer lifecycle;
- every product/background pair for the Nimbus fixture;
- every visible refinement direction;
- all export format/quality pairs;
- required desktop, tablet, and mobile viewports; and
- risk-based boundary, failure, rapid-change, and concurrency combinations.

The result is an exhaustive finite-control audit plus adversarial pairwise coverage, not a claim that every possible Unicode string or network timing was tested.

## Coverage and result

| Surface | Coverage | Result |
|---|---:|---|
| Active formats | 42/42 switched in Studio | Pass: all canvases present and fully visible in Fit; no stage/page scroll |
| Baseline generation | 42/42 active formats, fresh first request | Pass: all HTTP 200; zero conservative fallbacks |
| Product/background pairs | 4×4 = 16 | Pass for canvas dimensions; selected-state accessibility fails |
| Copy fields | 3 fields × grapheme, CJK, newline, wide glyph, hard max, max+1, empty | Grapheme and hard-limit counts pass; rapid-boundary recovery fails |
| Refinements | 9/9 | **Fail: only Shorter and Longer passed; 7 semantic directions returned 422** |
| Viewports | 1440×900, 1366×768, 1280×800, 768×1024, 390×844, 320×568 | Fit and zoom pass; compact target sizing needs work |
| Accessibility automation | axe WCAG 2 A/AA, 2.1 AA, 2.2 AA | Pass: 0 violations, 28 rule passes, 1 incomplete/manual review |
| Keyboard entry | initial Tab/focus | Pass: Skip to main content receives focus first |
| Review lifecycle | member → submit → approver reject → member edit/resubmit → approver approve | Pass |
| Rejection UI | 5 categories, required note, returned guidance | Pass |
| Export authorization | direct render before approval | Pass: HTTP 403 |
| Approved exports | PNG/JPEG/PDF × exact/2× | Pass: 6/6 HTTP 200 with correct MIME/signature |
| Two-tab edit | same member, same draft | **Fail: stale tab receives no conflict/failure signal** |
| Offline edit | browser offline during valid edit | **Fail: no clear unsaved/failure signal within 45 seconds** |
| Provider failure | guarded synthetic provider outage | Pass in 14.7s: bounded retries and validated fallback |
| Component/UI unit suite | 39 tests | Pass |

## Pilot-blocking findings

### CG-STUDIO-P1-001 — seven of nine refinement controls fail first request

**Severity:** P1

**Area:** core generation/refinement

**Frequency in the audit:** 7/9 (77.8%)

Passed:

- Shorter — HTTP 200
- Longer — HTTP 200

Failed:

- More strategic
- More playful
- More urgent
- Simpler
- On-brand voice
- Add proof point
- Lead with benefit

Every failure returned HTTP 422 with code `generation_variation_exhausted` and the visible message:

> ContentGate could not produce a meaningfully different alternate. Please try Generate again.

**Why this blocks pilot:** these are primary, visible Studio controls. A safe rejection is better than unsafe copy, but offering a control that fails most first requests makes the core service appear broken.

**Reproduction:** generate a Nimbus square draft, select each refinement, apply it once, and capture `/api/products/generate` plus the visible error.

**Acceptance gate:**

- Run all nine directions against at least five independently generated baselines.
- Each available direction must return usable, grounded, fit-safe copy on its first request in at least 95% of attempts.
- A direction that is impossible from approved evidence must be disabled before submission with a specific reason; it must not be offered and then fail generically.
- No direction may weaken citation/grounding or template-fit checks.

Evidence: `05-...-refinement-matrix.json` and the nine per-direction files in the evidence directory.

### CG-STUDIO-P1-002 — stale second tab receives no edit conflict signal

**Severity:** P1

**Area:** autosave/data integrity

**Reproduction:** open the same draft in two authenticated tabs. Save valid copy in tab 1. Without refreshing tab 2, enter different valid copy in the same field.

**Actual:** tab 2 did not show `Save failed` or `Changes not saved` within 45 seconds. The second value was displayed optimistically. A server reload still returned tab 1's value, proving the stale write was not persisted but the losing user received no warning.

**Expected:** the stale write is rejected by optimistic locking, Studio retains the user's unsaved value, and a persistent conflict panel offers Copy unsaved fields, Reload latest, and an explicit overwrite/merge path if policy allows it.

**Acceptance gate:** a two-tab deterministic test must prove the stale request cannot silently win and that both users can recover their text.

Evidence: `06-...-concurrent-edit-second-tab.png` and `06-...-findings.json`.

### CG-STUDIO-P1-003 — offline edit remains visually ambiguous

**Severity:** P1

**Area:** autosave/recovery

**Reproduction:** after a successful save, take the browser offline and enter valid within-limit copy.

**Actual:** the preview updates optimistically, but no clear `Save failed`/`Changes not saved` state appeared within 45 seconds. A server reload correctly discarded the offline value and returned the last saved value, but the user was never told that the visible edit would be lost.

**Why this blocks pilot:** a user can leave the page believing copy is durable when it is not.

**Acceptance gate:** within 10 seconds of an unpersisted edit, show a persistent error state with Copy unsaved fields and Retry/Refresh actions. Navigation must warn before discarding the unsaved value.

Evidence: `06-...-offline-save-state.png` and `06-...-findings.json`.

### CG-STUDIO-P1-004 — rapid boundary edits can strand fit/autosave state

**Severity:** P1

**Area:** copy measurement/autosave coordination

**Reproduction:** rapidly enter grapheme, CJK, newline, wide-glyph, exact-limit, over-limit, and empty values across all three fields, then restore the original valid values.

**Actual:** counters remained in `measuring…` during the sequence and Studio did not return to `Draft saved` or `Draft synced` within 45 seconds after the valid values were restored. Multiple in-flight Studio POST requests were aborted. More seriously, a server reload returned the old grapheme probe `👨‍👩‍👧‍👦👍🏽é` as the persisted headline even though the latest restored headline was `RUN ON AIR`.

**Expected:** obsolete checks may be cancelled, but the newest valid state must always complete measurement and persistence.

**Acceptance gate:** a deterministic rapid-edit test ends in one authoritative fit result and one saved latest value; no permanent `measuring…`, no false saved state, and no loss of copy.

Evidence: `02-...-copy-boundaries.json`, `02-...-boundary-persistence.json`, `02-...-runtime.json`, and `02-...-findings.json`.

### CG-STUDIO-P1-005 — selected product variant is not programmatically exposed

**Severity:** P1 accessibility

**Area:** visual asset picker

**Actual:** background choices use `role="radio"` and `aria-checked`; product-variant buttons expose only an accessible name. The selected variant is communicated by border/color only and has no `aria-pressed`, `aria-current`, or radio state.

**Expected:** one product variant is exposed as selected and keyboard navigation follows a documented selection pattern.

**Acceptance gate:** screen-reader inspection announces the group, option name, selected state, position, and changes; automated component coverage asserts exactly one selected option after save/reload.

Evidence: `02-...-asset-persistence.json` (`[0,1]`: zero selected product buttons, one selected background radio).

## Important non-blocking findings

### CG-STUDIO-P2-001 — first visual interaction can coincide with late typography settling

Across the 16 asset combinations, canvas dimensions stayed exactly `353px × 353px`. The first two observations used the authored 84px subheadline size; subsequent observations used the resolved 80.693px size with three rendered lines. The visual selection did not resize the canvas, but late fit calculation can make the first click look causal.

**Acceptance:** hydrate or calculate the authoritative text layout before enabling visual pickers, or show an explicit short loading state until layout is stable.

### CG-STUDIO-P2-002 — compact controls are below the preferred 44×44 touch size

At tablet width, 22 rendered controls/links were below 44px in one dimension. At 390px and 320px, five persistent navigation/header targets were below 44px. Axe reported no WCAG A/AA violation, so this is recorded as touch usability and enterprise polish, not an automated WCAG failure.

Examples include 38px selects/refinement chips, a 28px sign-out target, and 18–21px breadcrumb/back-link heights.

**Acceptance:** primary touch controls are 44×44 CSS pixels where practical, with at least the WCAG 2.2 target-size minimum/spacing everywhere.

## Passed boundaries worth preserving

- All 42 formats were selectable and fully visible in Fit at the audited viewport; no canvas/stage/page scroll was detected.
- All 42 formats generated fresh compliant baseline copy on their first request; all returned HTTP 200 with zero conservative fallbacks.
- Fit and Zoom In worked at all six viewports. Observed Fit → manual changes included 49→55%, 37→40%, 40→45%, 8→15%, 33→40%, and 27→30%.
- All 16 product/background pairs kept the canvas at the same dimensions.
- Visible-grapheme counts were correct for `👨‍👩‍👧‍👦👍🏽é` (3), and CJK counts were correct.
- Exact hard maxima were accepted by the character counter; max+1 reported `over by 1`.
- No ellipsis was injected into live preview copy during the audited boundary values.
- The complete reject/resubmit/approve lifecycle worked with a separate member and approver.
- A direct unapproved render returned HTTP 403 with `Only the currently approved revision can be rendered.`
- Approved PNG, JPEG, and PDF exports succeeded at exact and 2× quality with correct file signatures.
- axe found zero violations on the Studio route.
- The first keyboard Tab reached Skip to main content.
- The guarded provider-outage journey passed with bounded retries and a validated safe fallback.

## Known audit limitations

- Chromium only; Safari/WebKit and Firefox were not covered in this pass.
- axe and keyboard entry were automated; VoiceOver/NVDA manual screen-reader operation remains required.
- Nimbus v9 was the only product/template package.
- Staging only; production was intentionally untouched.
- No real client users, SSO, enterprise identity provider, or external assistive-technology reviewer.
- Visual comparison was DOM/geometry/screenshot based, not pixel-diffed against every Figma source frame.

## Evidence location

Durable local evidence:

`/private/tmp/contentgate-studio-audit-2026-08-01/evidence`

The audit harness is:

`tests/e2e/studio-pilot-exhaustive-audit.spec.ts`

The guarded all-format baseline-generation gate was:

`tests/e2e/generation-reliability-matrix.spec.ts` — 42/42 first requests passed in 10.9 minutes with zero fallbacks.

Do not promote the audited SHA to an external pilot until all P1 acceptance gates pass on a fresh Preview deployment.
