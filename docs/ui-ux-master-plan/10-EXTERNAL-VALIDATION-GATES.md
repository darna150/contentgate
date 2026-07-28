# External validation and rollout gates

These items cannot be truthfully completed by code changes alone. They are the
remaining gates for the UI/UX master plan after the implementation-ready work.

## Required before broader rollout

| Gate | Owner | Evidence required |
| --- | --- | --- |
| Five internal pilot walkthroughs | Product / research lead | Completion has been attested by the release owner for 2 authors, 2 reviewers, and 1 administrator. Record timings, confidence scores, and findings before broader rollout. |
| Keyboard-only walkthrough | Accessibility reviewer | Complete automated path passes: sign-in, skip link, Products/Reviews, author Studio format selection/submission, and reviewer Request changes on a disposable demo draft. Record an accessibility-reviewer observation before broader rollout. |
| Screen-reader walkthrough | Accessibility reviewer | Recorded pass/fail for context, status, loading, picker, citation, and review announcements. |
| Responsive device review | QA | Mobile viewport automation passes on five primary surfaces without document-level horizontal overflow or error overlay. A real Chrome 200% zoom check passes for Dashboard, Products, and non-mutating author Studio. Record physical-device and remaining-route results in [05-RESEARCH-ACCESSIBILITY-QA.md](./05-RESEARCH-ACCESSIBILITY-QA.md). |
| Measurement capture | Product / engineering | The privacy-safe event table, RPC, and pilot-flag-gated Studio instrumentation are deployed and browser-verified. Collect baseline and post-change values from [06-MEASUREMENT-PLAN.md](./06-MEASUREMENT-PLAN.md). |
| Feature-flag decision | Product / release owner | Complete: `uiux_campaign_pilot_enabled` is enabled for the Nimbus demo workspace. Release owner: Debbie Melgarejo. Set it to `false` to roll back the pilot presentation. |
| Rollout authorization | Product / governance owner | Complete: Debbie Melgarejo approved the ContentGate pilot rollout and confirmed no release blockers on 2026-07-28. |

## Implementation boundaries

- No campaign-wide approval or export is implemented. Approval and export
  remain per format by design.
- New Packshot uploads are server-verified for transparent pixels. Existing
  assets still need a migration review before they can be asserted to meet
  that same requirement.
- Pilot-session completion is recorded only as release-owner attestation. No
  timings, confidence scores, accessibility results, or usability findings are
  inferred from account setup or automated checks.

## Current automated evidence

- Full unit and integration test suite passed after the UI changes.
- Production build passed after the UI changes.
- Lint, typecheck, and diff-whitespace checks passed.
- Local authenticated browser verification passed on 2026-07-28: two authors
  reached Products, two reviewers reached Reviews, and one administrator
  reached Brand knowledge, all after a real password login in isolated browser
  sessions. Session-only test passwords were not retained.
- The Supabase RPC accepted an authenticated safe event and rejected a payload
  containing an email property. Direct client table writes remain unavailable.
- A live isolated-browser pilot login recorded a `studio_opened` event after
  the authenticated user reached Studio. The client allowlist strips user
  content, source text, IDs, URLs, emails, and credentials before the RPC call.
- The full authenticated app-surface suite passed locally after terminology
  assertions were aligned to the redesigned labels. It includes broken-image,
  error-overlay, main-landmark, visible-control-name, and duplicate-ID checks.
- A disposable demo draft completed the keyboard-only reviewer lifecycle:
  author submission through the UI, then reviewer Tab/Enter navigation through
  Request changes and required feedback. The resulting `rejected` status was
  verified without retaining credentials or user content.
- Final local release verification passed on 2026-07-28: the complete unit and
  integration suite, production build, authenticated mobile touch-target test,
  keyboard/skip-navigation test, health endpoint, and all major authenticated
  application surfaces. The surface suite found no broken visible images,
  error overlays, server failures, duplicate IDs, or unnamed visible controls.
- The Nimbus pilot flag remains enabled. The measurement table contains 61
  safe events from the current validation window, including five successful
  generation completions (7,961 ms median; 15,557 ms p95), two saves (2,424 ms
  median; 2,816 ms p95), and one safe generation-failure event. This proves
  collection and an initial technical timing baseline, not a human
  baseline/post-change outcome comparison.

## Security-advisor interpretation

The Supabase security advisor continues to flag several authenticated
`SECURITY DEFINER` governance RPCs, including the measurement writer. For the
measurement writer this is intentional: it checks `auth.uid()`, resolves the
caller organization server-side, allowlists event names, rejects sensitive
property keys, revokes `PUBLIC`/`anon` execution, and grants execution only to
`authenticated`; direct client table inserts remain unavailable. These
existing governance-RPC advisories need a separate platform-security review
before any broad security-cleanliness claim, but did not produce an automated
UI/UX regression in the final run.
