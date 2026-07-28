# Research, accessibility, and QA plan

## Research objective

Validate that a client can complete the campaign workflow without being taught ContentGate's internal architecture.

## Pilot readiness

The demo workspace has a five-person internal pilot cohort: two authors, two
reviewers, and one administrator. Account credentials are deliberately
distributed only through the approved secure channel.

Run one 45-minute walkthrough per participant. Capture task completion,
elapsed time, confidence (1–5), errors, and direct wording observations for
each scenario below. Do not use production client content or credentials.

After each session, record findings in the decision log with the scenario,
role, severity, and proposed follow-up. A finding that affects evidence,
approval, export, or locked designs is a release blocker until resolved.

## Core usability scenarios

Run these with a mix of authors, reviewers, and administrators. Use fictional Nimbus sources for all test content.

### Scenario 1 — First campaign draft

Prompt: “Create a square post for Nimbus 1, use the Volt Lime product color, and prepare it for review.”

Observe whether the participant can:

- Find Nimbus 1
- Identify the appropriate campaign
- Generate a draft
- Choose the product color
- Understand save state
- Know why export is unavailable
- Submit for review

Success: completed without explaining template, variant, assignment, or source mechanics.

### Scenario 2 — Source-backed refinement

Prompt: “Make this message more strategic and add a supported proof point.”

Observe whether the participant can:

- Find refinement controls
- Understand selected refinement direction
- Distinguish generation from visual changes
- Understand source support
- Recover when no proof point is available

Success: participant can explain why a proof point was accepted or blocked.

### Scenario 3 — Multi-format campaign

Prompt: “Prepare Instagram square, Story, and Facebook cover for the same campaign.”

Observe whether the participant can:

- Discover formats
- Understand each format's state
- Avoid thinking formats are unrelated drafts
- Identify which output still needs work

Success: participant can report campaign readiness without opening every output.

### Scenario 4 — Review decision

Prompt: “Review this submitted draft and request a change because the claim needs evidence.”

Observe whether the participant can:

- Find evidence
- Identify what changed
- Distinguish draft from original design
- Leave actionable feedback
- Understand lifecycle after request changes

Success: decision occurs without needing authoring controls.

### Scenario 5 — Approved export

Prompt: “Download the final Story asset at the correct size.”

Observe whether the participant can:

- Identify approved status
- Select format and quality
- Distinguish QA draft from approved output
- Understand download progress and completion

Success: participant expects the downloaded file and can identify it afterward.

## Interview questions

Ask after each scenario:

- What did you think would happen when you clicked that?
- What did this status mean to you?
- At what moment were you least certain?
- What information did you look for but not find?
- What wording felt technical or unclear?
- How confident are you that the output is brand-safe?
- What would you expect to happen next?

## Heuristic checklist

Use this checklist for every changed surface.

### Visibility of system status

- [ ] Save status is visible and stable.
- [ ] Generation state identifies real work, not generic waiting.
- [ ] Preview-update state differs from generation state.
- [ ] Download/export state is visible.
- [ ] Error indicates whether changes were preserved.

### Match with user mental model

- [ ] Product, Campaign, Draft, Format, Review, and Asset are used consistently.
- [ ] Internal template/storage terminology is absent from client flows.
- [ ] The next action matches the lifecycle state.

### User control and recovery

- [ ] Back navigation preserves useful context.
- [ ] Destructive actions have confirmation and recovery where appropriate.
- [ ] Conflicts offer a clear recovery path.
- [ ] Failed generation never replaces working copy with default copy.

### Consistency and standards

- [ ] Primary CTA treatment is consistent.
- [ ] Status colors/text/iconography are consistent.
- [ ] Picker interactions are visually differentiated by type.
- [ ] Empty/loading/error/success states use shared patterns.

### Error prevention

- [ ] Invalid exports are prevented before download.
- [ ] Overflow is field-specific and explains resolution.
- [ ] Unsupported proof points are blocked before or during generation with a source-specific reason.
- [ ] Invalid transparent assets are detected before Studio publication.

### Recognition over recall

- [ ] Selected product, background, refinement, format, and language are visible.
- [ ] Product/campaign/format context persists.
- [ ] Evidence and changes are inspectable without leaving review.

## Accessibility acceptance criteria

Target: WCAG 2.2 AA for primary workflows.

### Keyboard

- [x] Skip-to-main link works (automated Chromium verification on 2026-07-28).
- [x] Primary author and reviewer controls are reachable in logical reading order (authenticated keyboard walkthrough on 2026-07-28).
- [ ] Every focused control has high-visibility focus treatment.
- [ ] Dialog and mobile drawer focus traps work and restore focus on close.
- [ ] Picker groups use correct radio/pressed semantics and arrow-key behavior where applicable.
- [x] No keyboard trap was found in the tested Studio format picker, preview transition, submission, or reviewer Request changes path.

### Screen readers

- [ ] Context path, status, save state, and preview mode are announced.
- [ ] Loading announcements are brief and meaningful.
- [ ] Copy fit errors identify the field and required correction.
- [ ] Product/background picker options have useful labels.
- [ ] Citation controls announce source and paragraph identity.
- [ ] Review actions announce their consequences.

### Visual access

- [ ] Text contrast meets AA across all rendered surfaces (shared functional
  token pairs now have automated 4.5:1 regression coverage; full rendered-page
  audit remains).
- [ ] Status is communicated by label and icon/text, not color only.
- [ ] Meaningful metadata is at least 13–14px across all rendered surfaces (Studio and Reviews primary status, feedback, source-support, and campaign metadata were raised to 13px; full route audit remains).
- [x] Tested mobile dashboard and Studio button targets are at least 44×44px (390×844 Chromium automation on 2026-07-28).
- [ ] 200% browser zoom preserves complete primary workflows (real Chrome evidence now passes for Dashboard, Products, and a non-mutating author Studio view; remaining primary routes and a complete mutation-free lifecycle walkthrough still need recording).
- [x] Reduced-motion browser checks found no nontrivial animation or transition on the tested Dashboard, Products, and Studio paths.
- [ ] Preview never relies on color-only distinction between Draft and Original design.

## Responsive QA matrix

Test at minimum:

| Surface | Desktop | Tablet | Mobile |
|---|---:|---:|---:|
| Sidebar/navigation | ✓ | ✓ | ✓ |
| Dashboard | ✓ | ✓ | ✓ |
| Product workspace | ✓ | ✓ | ✓ |
| Content ledger | ✓ | ✓ | ✓ |
| Approvals | ✓ | ✓ | ✓ |
| Assets | ✓ | ✓ | ✓ |
| Ask | ✓ | ✓ | ✓ |
| Brand knowledge | ✓ | ✓ | ✓ |
| Studio author | ✓ | ✓ | ✓ |
| Studio reviewer | ✓ | ✓ | ✓ |
| Template Ops | ✓ | ✓ | operator-mobile fallback |

## Browser QA after each Studio change

Use `localhost:3001` and a safe demo/admin account. Do not run mutation-heavy test suites against production.

1. Open a fresh campaign draft.
2. Generate grounded copy.
3. Verify fit and stable preview.
4. Change each product option serially; wait for saved state.
5. Change each background option serially; wait for saved state.
6. Test each refinement serially; wait for generation completion between actions.
7. Switch representative square, landscape, and vertical formats.
8. Compare Working preview and Original design.
9. Submit/review/approve or request changes with a test draft.
10. Test draft QA download and approved export path according to role.
11. Inspect console logs, broken images, and errors.

Never use rapid repeated clicks as an ordinary acceptance path; use it separately as resilience testing and report it as such.

## Automation additions

Expand the Playwright suite in `docs/e2e-qa.md` only after behavior is stable. Add coverage for:

- Context preservation from Product → Studio → Product
- Save-state and optimistic-lock recovery
- Product/background picker thumbnails and persistence
- No blank preview during supported format switch
- Source-backed proof-point behavior
- Campaign grouping and output readiness
- Reviewer change summary and request-changes feedback
- Responsive Studio primary actions
- Keyboard-only picker and review flow

## Automated keyboard evidence

The Playwright app-surface suite includes a non-mutating keyboard smoke test
that signs in with Tab/Enter, verifies the first focused element on a fresh
page is the skip link, verifies that it transfers focus to `main`, and reaches
Products and Reviews through keyboard navigation. It passed locally on
2026-07-28 with the authorized pilot author account.

This is partial automated coverage, not a substitute for the remaining
screen-reader evaluation, rendered-page/zoom audit, or physical-device
acceptance matrix.

An additional authenticated Studio check on 2026-07-28 verified that the
format combobox opens with Space, closes with Escape, restores focus to the
combobox, and advances to Working preview with Tab. A disposable demo draft
was submitted through the UI, then a reviewer used only Tab/Enter to open
Request changes, reach the required feedback field, and complete the decision.
The final lifecycle status was verified as `rejected`. No credentials or
participant content were retained.

## Automated responsive evidence

At a 390×844 mobile viewport on 2026-07-28, authenticated browser checks
loaded Products, Content, Reviews, Brand knowledge, and Studio with non-empty
content, no framework error overlay, and no document-level horizontal
overflow. This viewport check is not evidence of physical-device behavior,
assistive-technology output, or 200% browser-zoom acceptance.

At a 640×900 viewport with `prefers-reduced-motion: reduce`, authenticated
Dashboard, Products, and Studio checks completed without document overflow or
nontrivial computed animation/transition durations. A separate 390×844 check
found no visible Dashboard or tested Studio buttons below 44×44px after the
mobile target rule was applied.

## Real-browser zoom evidence

On 2026-07-28, a real authenticated Chrome session was set to 200% browser
zoom (then restored to 100%). Dashboard, Products, and a non-mutating author
Studio view remained available with responsive navigation, readable controls,
and no observed horizontal-layout failure. Keyboard Tab focused the skip link,
and Enter transferred focus to the main-content anchor. This is stronger than
viewport simulation but remains a partial route sample, not the full
primary-workflow zoom acceptance gate.

## Automated color-contrast evidence

The functional color tokens used for brand, approval, warning, rejection,
muted, and faint text are checked against their surfaced backgrounds in the
unit suite. Each checked normal-text pairing, plus white text on filled
functional controls, meets a 4.5:1 minimum contrast ratio. This protects the
shared token layer; it does not replace a rendered-page contrast audit for
opacity, image, or custom-color cases.

## Automated semantic evidence

The authenticated app-surface Playwright suite checks every major route for a
single `main` landmark, visible interactive controls with an accessible name
(including native label associations), and duplicate IDs. The full route suite
passed locally on 2026-07-28 alongside its broken-image and error checks.
This is structural evidence only; it does not validate spoken announcements or
the quality of screen-reader wording.
