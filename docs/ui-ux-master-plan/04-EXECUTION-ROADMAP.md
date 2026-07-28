# Execution roadmap

## Operating rules

- Work one phase at a time.
- Do not begin visual polish while the relevant information architecture or state model is undecided.
- Every phase requires product/design sign-off, proportional tests, and browser verification.
- Preserve Figma, governance, evidence, and lifecycle constraints.
- Update this document as each checklist item is completed, deferred, or changed.

## Current program tracking

| Phase | Status | Evidence / remaining risk |
| --- | --- | --- |
| Phase 0 | In progress | Current Nimbus baseline captures, terminology, role model, initial campaign-format scope, and decision log exist. Privacy-safe Studio funnel/timing instrumentation is live; the release owner-attested five-role walkthrough still needs recorded timings, confidence scores, and findings. |
| Phase 1 | In progress | Context, terminology, grouped activity, clearer content labels, and preserved Content/Product/Review → Studio return paths are implemented. Real-user validation remains. |
| Phase 2 | In progress | Studio controls are organized as Message, Visuals, Formats, and Review; visual choices use distinct signed asset/background thumbnail treatment; original-design continuity, operation language, progressive refinements, grouped formats, mobile-first structure, and autosave/preview recovery states are implemented. Full author/reviewer acceptance remains. |
| Phase 3 | In progress | Product Content, global Content, Dashboard, and Reviews group related formats into campaign packages. Formats start independently, can explicitly copy from campaign, and show per-format lifecycle readiness; campaign-wide export remains intentionally excluded. |
| Phase 4 | In progress | Client review language, change summary, field-level source excerpts, fit decision cues, feedback categories, and per-format package review are updated. Real reviewer timing validation remains. |
| Phase 5 | In progress | Brand knowledge language, source indexing/approval cues, asset metadata, Ask scope/source support, and verified alpha enforcement for new packshots are implemented. Existing-asset migration review remains. |
| Phase 6 | In progress | Keyboard-only author and reviewer decision paths, mobile touch targets, reduced motion, semantic checks, shared-token contrast regression coverage, and 13px primary-workflow status/feedback metadata pass in implementation and automation. Assistive-technology, rendered-page contrast, zoom, and physical-device acceptance remain external validation. |
| Phase 7 | In progress | The Nimbus pilot flag is enabled, privacy-safe measurement storage is deployed and access-tested, five pilot accounts have passed authenticated browser route verification, and written rollout approval is recorded. Metric comparison and findings follow-up remain. |

## Phase 0 — Baseline and decisions

Goal: establish evidence and prevent subjective redesign drift.

- [ ] Capture current desktop, tablet, and mobile screens for all primary routes.
- [x] Run five moderated usability sessions or structured internal walkthroughs (completion attested by the release owner; raw session records remain to be captured).
- [x] Instrument baseline timing and funnel events from the measurement plan (pilot-flag-gated Studio telemetry; collection and comparison remain ongoing).
- [x] Confirm user-facing terminology table (implemented presentation boundary in [North-star experience](./02-NORTH-STAR-EXPERIENCE.md)).
- [x] Confirm client/admin role distinctions (author, reviewer/approver, and administrator journeys are defined and role-gated in the app shell).
- [x] Identify the initial campaign-format subset for the redesigned Studio (Nimbus pilot starts with Instagram square, Instagram story, and Facebook cover representative formats; formats remain independent by default).
- [x] Create a decision log for material UX choices.

Exit criteria:

- Baseline evidence exists.
- Terminology and scope model are approved.
- No implementation has changed backend governance.

## Phase 1 — Context, language, and action hierarchy

Goal: make every screen explain scope, state, and next action.

- [x] Add a reusable context-path component.
- [x] Standardize product/campaign/draft naming at presentation boundaries.
- [x] Define a shared primary-action model for each lifecycle state.
- [x] Standardize save, loading, error, and recovery copy.
- [x] Rework dashboard activity presentation to group campaign output sessions.
- [x] Update content-row labels to reduce duplicate indistinguishable titles.
- [x] Preserve Content filters and Product/Review context when returning from Studio.

Dependencies: baseline terminology approval.

Exit criteria:

- A user can identify current workspace, product, campaign, format, and draft status from every deep view.
- No user-facing page requires internal platform terminology.

## Phase 2 — Studio foundation

Goal: make Studio's core authoring flow calm and self-explanatory.

- [x] Implement stable workflow header and save-state area.
- [x] Reorganize author controls into Message, Visuals, Formats, Review.
- [x] Separate visual-picker treatment by control type.
- [x] Add thumbnail-ready states for products and backgrounds.
- [x] Preserve prior preview during every update.
- [x] Add real operation stages for generation/rendering.
- [x] Add local recovery for autosave conflict and preview failure.
- [x] Group formats by channel and provide clear readiness state.
- [x] Verify keyboard, mobile, and reduced-motion behavior (automated authenticated Studio checks cover format selection, submission, reviewer Request changes, mobile overflow/touch targets, and reduced motion).

Dependencies: Phase 1 context language.

Exit criteria:

- Fresh generation, text edit, visual picker, format switch, reviewer view, and draft download work without blank preview or ambiguous status.
- No format switch alters locked design geometry.

## Phase 3 — Campaign-level workflow

Goal: represent a multi-format campaign as one coherent object.

- [x] Add campaign output overview in the product Content view.
- [x] Define format inheritance rules for copy and visual choices.
- [x] Add per-format readiness, fit, and lifecycle states.
- [x] Design campaign-level review queue representation.
- [x] Group dashboard and ledger results by campaign with drill-down.
- [x] Add campaign-level package/export decision design; do not implement bulk export until approval rules are explicit.

Dependencies: stable Studio format model.

Exit criteria:

- Users can answer which outputs are ready without opening each format.

## Phase 4 — Review and approval

Goal: reduce reviewer effort and make changes inspectable.

- [x] Build change summary.
- [x] Surface citations/evidence and fit/compliance status.
- [x] Rename reject action to Request changes in client-facing flows.
- [x] Add structured feedback categories.
- [x] Refine urgency language by role (Reviews uses neutral `waiting` age language and reserves `Overdue for review` for items older than two days).
- [x] Preserve approval/export lifecycle enforcement.

Dependencies: campaign and Studio state contracts.

Exit criteria:

- A reviewer can approve or request changes with confidence in under two minutes for a typical draft.

## Phase 5 — Assets and brand knowledge trust

Goal: prevent invalid visual/source input before it reaches Studio.

- [x] Add asset readiness, dimensions, and alpha/transparency signals.
- [x] Add transparent-cutout validation warnings to intake/publish workflow.
- [x] Consolidate Brand knowledge terminology.
- [x] Make document indexing/approval/citable states explicit.
- [x] Improve Ask scope and source-support communication.

Dependencies: asset metadata and product/source contracts.

Exit criteria:

- An opaque fake-transparent product asset is caught before it becomes a Studio choice.
- An author can determine whether a source is usable without asking an admin.

## Phase 6 — Responsive, accessibility, and perceived performance

Goal: ensure the experience is usable in real client conditions.

- [x] Build mobile-first Studio interaction model.
- [x] Add a working skip-to-main link and cross-app visible focus treatment.
- [x] Respect the system reduced-motion preference.
- [x] Complete keyboard-only route walkthroughs (authenticated author and reviewer Studio flows; reviewer Request changes was completed on a disposable demo draft).
- [ ] Complete screen-reader route walkthroughs.
- [ ] Audit contrast, text size, touch targets, zoom, and reduced motion (shared-token contrast, mobile touch-target, and reduced-motion automation pass; rendered-page text-size/contrast and 200% zoom acceptance remain).
- [x] Establish preview/load performance budgets.
- [ ] Implement only performance improvements with measurable benefit.

Dependencies: stable desktop interaction patterns.

Exit criteria:

- WCAG 2.2 AA target met for primary workflows.
- Core Studio interaction has a validated mobile path.
- Preview and action feedback meet defined experience budgets.

## Phase 7 — rollout and refinement

Goal: ship safely and improve with evidence.

- [x] Feature-flag material workflow changes (Nimbus `uiux_campaign_pilot_enabled`).
- [x] Pilot with one internal/demo workspace (five provisioned role accounts; authenticated browser routes verified).
- [ ] Compare baseline and post-change metrics.
- [ ] Address usability findings before broader rollout.
- [x] Update E2E coverage for all changed paths (authenticated author, reviewer, and admin browser walkthrough coverage recorded for the pilot accounts).
- [ ] Remove temporary dual-path UI only after adoption is stable.

## Definition of done for any phase

- Product/design decision logged.
- Required user states designed: default, loading, empty, error, success, disabled, permission-denied.
- Responsive treatment specified.
- Accessibility acceptance criteria satisfied.
- Backend/lifecycle impact reviewed.
- Automated tests updated where behavior changes.
- Browser test covers the complete changed workflow.
- Analytics events and failure reasons documented.
- No unrelated dirty-worktree changes were overwritten.

## Decision log template

```md
### Decision: <name>

- Problem:
- Affected roles:
- Evidence:
- Proposed behavior:
- Alternatives considered:
- Governance impact:
- Accessibility impact:
- Performance impact:
- Acceptance criteria:
- Owner/date:
- Decision:
```
