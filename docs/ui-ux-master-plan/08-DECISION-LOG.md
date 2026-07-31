# UI/UX decision log

## Decision: Accessible functional color tokens

- Problem: the initial bright teal and warning colors fell below the WCAG AA
  normal-text contrast threshold on white or their status tints.
- Affected roles: all client and operator roles.
- Current evidence: measured token audit on 2026-07-28.
- Proposed behavior: use darker teal and warning tokens that meet at least
  4.5:1 on their intended backgrounds; keep a unit test over the shared CSS
  token definitions.
- Alternatives considered: retain the existing palette and rely on larger or
  bolder type, or apply ad-hoc dark text at individual call sites.
- Governance impact: none.
- Accessibility impact: makes functional status, links, labels, and buttons
  readable at normal text sizes without relying on color alone.
- Performance impact: none.
- Backend/data impact: none.
- Acceptance criteria: functional token combinations used by normal text and
  filled controls meet a 4.5:1 ratio; a regression test fails if they drift.
- Owner/date: Codex / 2026-07-28.
- Final decision: implemented and tested; rendered-page audit remains.

## Decision: Nimbus pilot flag and privacy-safe measurement

- Problem: the pilot needs a reversible rollout control and outcome evidence
  without recording copy, source text, signed URLs, credentials, or emails.
- Affected roles: authors, reviewers, administrators, and the release owner.
- Current evidence: release-owner direction and Supabase verification on
  2026-07-28.
- Proposed behavior: enable `uiux_campaign_pilot_enabled` only for the Nimbus
  demo organization. Record an allowlisted set of UI/UX events through an
  authenticated RPC that rejects sensitive property names; no client receives
  direct insert access to the event table.
- Alternatives considered: a paid external flag/analytics service or generic
  client-side event payloads.
- Governance impact: none; review and export remain per-format lifecycle gates.
- Accessibility impact: none.
- Performance impact: a small, asynchronous event write only when instrumented
  interactions are emitted.
- Backend/data impact: adds organization feature flags, measurement events, and
  an authenticated validation RPC.
- Implementation: the Studio emits flag-gated, allowlisted lifecycle metadata
  for open, format/picker selection, autosave, generation, review, and export.
  Instrumentation is non-blocking and cannot affect governed workflow actions.
- Acceptance criteria: flag can be disabled for rollback; authenticated safe
  events record; sensitive event properties reject; direct client inserts fail.
- Owner/date: Debbie Melgarejo / 2026-07-28.
- Final decision: approved and deployed for the Nimbus internal pilot.

## Decision: ContentGate pilot rollout authorization

- Problem: the prepared pilot required a named release owner and explicit
  authorization before enabling it.
- Affected roles: five internal pilot participants and the release owner.
- Current evidence: written approval from Debbie Melgarejo on 2026-07-28.
- Proposed behavior: run the pilot in the Nimbus demo workspace with two
  authors, two reviewers, and one administrator. Keep credentials session-only
  until an approved distribution mechanism exists.
- Alternatives considered: distributing passwords in chat/repository or using
  a paid password vault; both are excluded.
- Governance impact: none; all existing approval/export gates stay active.
- Accessibility impact: automated browser coverage does not replace the
  remaining keyboard, screen-reader, and device acceptance checks.
- Performance impact: none.
- Backend/data impact: five existing pilot accounts reset only for session
  verification; no password was retained in code, documentation, or chat.
- Acceptance criteria: real login works for every role and each reaches a
  role-relevant workspace route; no release blocker is reported by the owner.
- Owner/date: Debbie Melgarejo / 2026-07-28.
- Final decision: approved. Browser verification passed for all five accounts.

## Decision: Phase 1 client terminology boundary

- Problem: client routes expose implementation vocabulary such as Templates,
  Source Documents, template variant, Reference, and Reject.
- Affected roles: authors, reviewers, approvers, and administrators.
- Current evidence: master-plan audit; source inspection on 2026-07-27.
- Proposed behavior: use Campaigns, Brand knowledge, Format, Original design,
  and Request changes at client presentation boundaries. Preserve technical
  terminology inside Template Ops and all data/API contracts.
- Alternatives considered: renaming database columns or retaining the existing
  terminology with explanatory help text.
- Governance impact: none; the same locked-design, evidence, approval, and
  export rules remain visible with clearer language.
- Accessibility impact: clearer labels reduce cognitive load and improve
  screen-reader comprehension.
- Performance impact: none expected.
- Backend/data impact: none; this is presentation-only.
- Acceptance criteria: no client-facing primary workflow requires a user to
  understand assignments or variants; Template Ops remains technically clear.
- Owner/date: Codex / 2026-07-27.
- Final decision: approved provisionally for Phase 1 implementation.

## Decision: Phase 1 context-path contract

- Problem: deep routes do not consistently state product, campaign, format,
  draft state, and return destination.
- Affected roles: authors and reviewers primarily; administrators secondarily.
- Current evidence: master-plan audit and current Studio source inspection.
- Proposed behavior: add a reusable context path that accepts presentation
  labels and optional back destination. Adopt it first on deep product, Studio,
  content, and review surfaces.
- Alternatives considered: breadcrumbs only in Studio, or per-route bespoke
  back links.
- Governance impact: none; context makes locked choices and lifecycle state
  more understandable.
- Accessibility impact: semantic navigation labels and an explicit current item
  improve orientation.
- Performance impact: negligible client render cost.
- Backend/data impact: no schema changes; routes pass existing IDs/names.
- Acceptance criteria: every updated deep screen identifies current scope and
  return destination without exposing internal IDs.
- Owner/date: Codex / 2026-07-27.
- Final decision: approved provisionally for Phase 1 implementation.

## Decision: Campaign format inheritance

- Problem: a multi-format campaign must be coherent without silently applying
  copy or visuals where size-specific rules may differ.
- Affected roles: authors and reviewers.
- Current evidence: user decision on 2026-07-27.
- Proposed behavior: each format starts independently. Studio may offer an
  explicit `Copy from campaign` action; no copy or visual choice propagates
  automatically.
- Alternatives considered: automatically inherit copy and visual choices.
- Governance impact: preserves explicit, auditable decisions and independent
  size-specific fit validation.
- Accessibility impact: the action is explicit rather than hidden state.
- Performance impact: no background writes or preview updates occur on format
  selection.
- Backend/data impact: uses the existing optional source-draft generation
  contract; no schema change required.
- Acceptance criteria: selecting a new format never modifies it; copying is a
  distinct user action and retains locked layouts.
- Owner/date: Product direction / 2026-07-27.
- Final decision: approved.

## Decision: Campaign package review

- Problem: reviewers need related-format context without weakening exact
  revision approval or per-format export enforcement.
- Affected roles: reviewers, approvers, and authors.
- Current evidence: product direction on 2026-07-27.
- Proposed behavior: group related in-review formats into a campaign package
  view; each row retains an independent review decision and export gate.
- Alternatives considered: per-format-only review or campaign-wide approval.
- Governance impact: preserves exact revision approval and individual exports.
- Accessibility impact: package count and individual status remain textual.
- Performance impact: client-side presentation grouping only.
- Backend/data impact: none.
- Acceptance criteria: no package action can approve or export multiple
  formats; reviewers can see all related formats before opening one.
- Owner/date: Product direction / 2026-07-27.
- Final decision: approved.

## Decision: Structured request-changes feedback

- Problem: free-form feedback alone makes recurring review issues difficult to
  scan and leaves authors without a clear starting point.
- Affected roles: reviewers, approvers, and authors.
- Current evidence: Phase 4 review scenario and internal-pilot preparation on
  2026-07-27.
- Proposed behavior: a reviewer selects one category (Claim or evidence, Copy
  or message, Visual choice, Fit or layout, or Other) and provides a required
  explanation. The selected category is stored as part of the existing
  rejection note; approval remains per format.
- Alternatives considered: a new structured database field, optional tags, or
  free-form notes only.
- Governance impact: none; lifecycle transitions, evidence enforcement, and
  export gates are unchanged.
- Accessibility impact: native labeled select control and required explanatory
  text remain keyboard and screen-reader reachable.
- Performance impact: none.
- Backend/data impact: uses the existing rejection-note contract, avoiding a
  schema change during the pilot.
- Acceptance criteria: authors receive a visible category and explanation for
  every request-changes decision; no category can approve multiple formats.
- Owner/date: Codex / 2026-07-27.
- Final decision: approved provisionally for the internal pilot.

## Decision: Packshot transparency verification

- Problem: a file extension or a checkerboard-looking preview cannot prove
  that a product cutout actually has transparent pixels.
- Affected roles: administrators, authors, and reviewers.
- Current evidence: Phase 5 asset intake review on 2026-07-27.
- Proposed behavior: new assets uploaded as Packshots must be decoded on the
  server and contain actual transparent pixels. The upload dialog states this
  requirement before submission.
- Alternatives considered: trust PNG/WebP filenames, infer transparency from
  browser preview appearance, or accept opaque files with a warning.
- Governance impact: prevents invalid visual inputs before they can become
  approved Studio choices; locked template geometry remains unchanged.
- Accessibility impact: the requirement is plain text and the server error is
  surfaced through the existing upload alert.
- Performance impact: uses the image metadata pass plus a pixel-stat check
  only for Packshot uploads.
- Backend/data impact: no schema change; enforcement applies to new Packshot
  uploads, while existing assets retain their current lifecycle state.
- Acceptance criteria: opaque Packshot uploads fail before storage/database
  insertion; non-Packshot assets are unaffected.
- Owner/date: Codex / 2026-07-27.
- Final decision: approved provisionally for the internal pilot.
