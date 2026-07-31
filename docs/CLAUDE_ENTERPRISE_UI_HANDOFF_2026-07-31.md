# Claude enterprise UI handoff — 2026-07-31

Owner: Claude (UI/UX implementation)
Recipient: Codex (release captain)
Status: **ready for Codex** — PR #59 marked ready for review, not merged.

## 1. Provenance

| | |
|---|---|
| Original base SHA | `384722294329ff35f0585277992b324892fa40b6` |
| Merge base (current) | `251d48d33dcfaa473ee29c9803208ddfd4af4ce5` |
| Final Claude SHA | `9eec7028d13e3fe79721feb1572b01d44f46e1b8` (plus this doc commit — see PR head) |
| Claude branch | `claude/enterprise-ui-pilot` |
| PR | [#59](https://github.com/darna150/contentgate/pull/59) → `codex/complete-build-source-of-truth` (**never** `main`) |
| Exact Preview | `https://contentgate-git-claude-enterpr-ed4f08-debbies-projects-a8de6bb4.vercel.app` |
| Worktree | `.claude/worktrees/enterprise-ui-pilot` |

`origin/codex/complete-build-source-of-truth` @ `251d48d` was merged into this
branch (merge commit `07d22a9`). No commit was rewritten and nothing was
force-pushed.

## 2. Correction to an earlier commit

Commit `0286650` is titled *"ui: improve operator onboarding and
authentication"* and contains **only onboarding work** — two files, no auth.
The title came from the brief's prescribed commit sequence and was left on a
commit that had not earned the second half. Authentication was actually done
later, in `1dce7e4`. Recorded by note rather than rewrite, since the commit is
already published. Full detail: `docs/CLAUDE_UI_COMMIT_CORRECTION_2026-07-31.md`.

## 3. Completed / partial / not covered

### Completed

| Area | What was done |
|---|---|
| Content ledger | Rebuilt on `campaignName` + `revisionNumber`; title preserved; format its own column; row alignment fixed |
| Authentication | Expired-link dead end closed; enumeration-safe errors; network-failure lockout fixed on 3 forms; autofill pairing |
| Onboarding presentation | Environment banner (production ≠ staging); resumed vs fresh receipt; failure state honesty; in-flight state; hydration bug |
| Studio governed states | Verified against real draft / rejected / approved content; reviewer note raised above the editor |
| Focus visibility | Ring contrast raised from ~1.8:1 to measured 5.2:1 across every button, dialog close and asset card |
| Error-to-field association | `aria-invalid` + `aria-describedby` + `role="alert"` + focus movement on password setup/recovery |
| Manual a11y | 200% reflow, reduced motion, keyboard-only, touch targets — all verified; one target-size defect fixed |
| Automated sweep | 75 route × viewport combinations, 0 axe violations, 0 overflow, 0 console errors |

### Partial

| Area | Done | Gap |
|---|---|---|
| Studio lifecycle | draft, rejected, approved verified with real staging content | **in-review never seen** — staging holds no content in that state |
| Onboarding states | resumed receipt, failure, in-flight, preflight-blocked, package selection | **A real provision was not executed by me.** Codex has proven provisioning, replay and guarded cleanup; I verified how those outcomes *present*, by rendering the receipt and failure states directly |
| Component system | Buttons, inputs, textareas, dialog, badge, confirm-dialog, asset card audited against the checklist | Tabs, dropdown-menu, select, scroll-area, sonner, skeleton, tooltip, separator **not individually audited** — they raised no findings in the route sweep but were not opened |
| Roles | admin + platform operator (the QA account) | **member, author, approver never seen.** Role-gating is asserted by the E2E suite, not by me |

### Not covered

- **Mutating flows were never executed**: generation, save, submit-for-review,
  approve, reject, export, provisioning, cleanup. Their *code paths* were read
  and their *rendered states* verified where reachable, but no write was made to
  staging beyond authentication.
- **Cleanup messaging** — no cleanup UI exists in the operator panel to audit;
  the failure state now references cleanup honestly, but there is no cleanup
  surface of my own to verify.
- **Priority B/C routes** (`/settings`, `/ask`, `/ask/quality`, `/templates`
  beyond one fix) received automated sweep coverage only, not a design pass.

## 4. Environment discipline

Production (`egjssfcenboalijfdmsi`) was **never** used. All verification ran
against staging (`bncwjibscptgijgmuhrn`), confirmed before use without printing
secrets:

- `CONTENTGATE_SUPABASE_PROJECT_REF=bncwjibscptgijgmuhrn` ✓
- `CONTENTGATE_ENVIRONMENT=staging` ✓
- `CONTENTGATE_ALLOW_PRODUCTION_ONBOARDING` not enabled ✓
- no production ref in either env file ✓

The exact Preview was **independently confirmed staging-backed** before any test
ran against it: a deliberately invalid sign-in was used to make the auth request
observable, and the only Supabase host contacted was `bncwjibscptgijgmuhrn`.
Codex's `assertSafeE2ETarget` also passed the host.

Recorded incidents: on two occasions `preview_start` resolved to a `launch.json`
config pointing at a checkout carrying the production `.env.local`. Both servers
were stopped within seconds having issued only a `/login` GET and a session
check. No writes occurred. (Codex's `251d48d` made `launch.json`
checkout-independent, which removes the `cwd` but means the preview tool now
defaults to the session's primary checkout — see §7.3.)

## 5. Verification results

| Gate | Result |
|---|---|
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm test` | **326 tests, 326 pass, 0 fail** (12 suites) |
| `npm run build` | pass, 34 routes |
| `npm audit --omit=dev --audit-level=high` | **0 vulnerabilities** |
| `npm run test:e2e:deterministic` — localhost:3200 | **17 passed, 2 skipped, 0 failed** |
| `npm run test:e2e:deterministic` — **exact Preview** | **17 passed, 2 skipped, 0 failed** |
| Route × viewport axe sweep | **75/75 clean** |

E2E fixture note: `CONTENTGATE_E2E_ASSIGNMENT_ID` is not discoverable from the
UI, so a placeholder was used. The only route consuming it
(`/products/:id/templates/:assignmentId`) is a declared redirect contract where
the id is not meaningful. Every other fixture value is a real staging record.

### Manual accessibility (things the sweep cannot assert)

| Check | Result |
|---|---|
| 200% zoom / reflow at 640 CSS px, 9 routes | no horizontal scrolling |
| `prefers-reduced-motion` | media matches; nothing animates or transitions > 50ms |
| Keyboard-only, 30 tab stops | every stop had a visible indicator (except the Next.js dev overlay) |
| Touch targets (SC 2.5.8) | one defect at 117×20, fixed; all clean after |
| Focus indicator contrast (SC 1.4.11) | measured 5.2:1 after fix, was ~1.8:1 |

## 6. Studio — every changed interaction

Shared-risk. All presentation; contracts verified intact by the four
`studio-viewport` contract tests passing on **both** localhost and the Preview.

1. Export label distinguishes three cases: "Download original design …",
   "Download draft …", "Export approved …". Confirmed against real content —
   draft shows "Export — locked until approved" (disabled), rejected shows
   "Download draft PNG", approved shows "Export approved PNG".
2. Locked-export reason moved from a `title` on a disabled (unfocusable) button
   into visible text, still referenced by `aria-describedby`.
3. Export bar wraps instead of forcing a 260px minimum on narrow viewports.
4. Empty required fields read `0/24 · required` in neutral type instead of red
   `0/24 · needs edit`.
5. The reviewer's rejection note moved above the Message editor (it rendered
   below the Generate button, under the fold at 1440×900).

**Verified unchanged:** generation payloads, autosave sequencing, optimistic
locking, fit validation (`hasIssues` still gates submission), evidence
validation, review transitions, revision semantics, export eligibility
(`downloadDisabled` / `draftPreviewDownloadAllowed` byte-identical), the 50%
scale floor, fit/50%/100% zoom, canvas overflow and scrolling.

Measured floor on the Preview: 1366×768 → 50.0%, 1280×800 → 50.0%,
1440×900 → 56.1%.

## 7. Unresolved engineering findings for Codex

**7.1 — `qaEnvironment` values render in the operator receipt.**
`onboarding-panel.tsx` prints `receipt.qaEnvironment` as `NAME=value` pairs
inside a `<details>`. It is operator-only and may be intended, but the brief
says not to expose secrets and I could not establish what that map can contain.
Worth a decision. Not changed.

**7.2 — `ANTHROPIC_API_KEY` still present in the primary checkout `.env.local`.**
Anthropic was removed on 2026-07-20 and must not return. Stale local env var,
not code. Env files are Codex-owned — flagged, not touched.

**7.3 — `launch.json` now has no `cwd`.**
`251d48d` made it checkout-independent, which is right for CI, but the local
preview tool then defaults to the session's primary checkout. On this machine
that checkout carries the production `.env.local`, which is how the two
incidents in §4 happened. Consider whether local tooling should fail closed when
`CONTENTGATE_ENVIRONMENT` is unset or production.

**7.4 — `aria-invalid` is styled but almost unused.**
`Input` and `Textarea` have carried `aria-invalid:border-reject` since they were
written. Only the password setup form now sets it. Every other form in the
product still shows unassociated form-level errors. Systematic adoption is a
larger change than this pass.

**7.5 — no content in `in_review` on staging.**
Blocks visual verification of the reviewer-facing Studio state and of the
approvals queue with real pending records.

## 8. Files changed (vs merge base `251d48d`)

```
src/app/(app)/content/page.tsx
src/app/(app)/onboarding/environment-banner.tsx        (new)
src/app/(app)/onboarding/onboarding-panel.tsx
src/app/(app)/onboarding/onboarding-workflow.tsx
src/app/(app)/onboarding/package-builder.tsx
src/app/(app)/products/page.tsx
src/app/(app)/studio/studio-fields.tsx                 ** shared-risk **
src/app/(app)/studio/studio-toolbar.tsx                ** shared-risk **
src/app/(app)/studio/studio-workspace.tsx              ** shared-risk **
src/app/(app)/templates/template-ops-actions.tsx
src/app/forgot-password/forgot-password-form.tsx
src/app/login/login-form.tsx
src/app/login/page.tsx
src/app/welcome/welcome-client.tsx
src/components/assets/asset-card.tsx
src/components/dashboard-summary-panel.tsx
src/components/ui/button.tsx                           ** all consumers **
src/components/ui/dialog.tsx
docs/CLAUDE_ENTERPRISE_UI_HANDOFF_2026-07-31.md
docs/CLAUDE_UI_COMMIT_CORRECTION_2026-07-31.md
docs/evidence/claude-enterprise-ui-2026-07-31/*.png
```

`src/components/ui/button.tsx` changes the focus ring for **every button in the
product**. It is a one-token change and the safest way to fix the defect at
source, but it is the widest-blast-radius edit in the branch.

## 9. State and role evidence

| Evidence | File |
|---|---|
| Content ledger with campaign grouping + revision | `after-content-ledger-revision__1280x800.png` |
| Content ledger before | `before-content__1280x800.png` |
| Studio rejected, note above editor | `studio-rejected-note-above-editor.png` |
| Studio approved, read-only, approved-only export | `studio-approved-readonly.png` |
| Studio empty-field + export label | `before-`/`after-studio-new__1280x800.png` |
| Operator environment, all three tones | `environment-tones-all-three.png` |
| Onboarding resumed receipt + failure state | `onboarding-resumed-receipt-and-failure.png` |

All in `docs/evidence/claude-enterprise-ui-2026-07-31/`.

Roles exercised: **admin + platform operator only** (`qa-accessibility@contentgate.example`).

## 10. Assumptions needing product approval

1. **"Unassigned campaign"** is the group label for rows with no `campaignName`.
2. **Audience** is the secondary line under a content title. Campaign, format,
   language and revision now each have their own place.
3. **Revision renders as `r2`** with a screen-reader-only "Revision" prefix.
4. **An unconfigured `CONTENTGATE_ENVIRONMENT` is presented as unsafe** (amber,
   "treat it as unsafe"), not neutral.
5. **Sign-in never distinguishes "no such account" from "wrong password"**, and
   never surfaces "Email not confirmed". That is deliberate enumeration safety
   and it does mean an unconfirmed user gets no specific guidance beyond the
   always-present "Forgot password?" route.
