# Claude enterprise UI handoff — 2026-07-31

Owner: Claude (UI/UX implementation)
Recipient: Codex (release captain)

## 1. Provenance

| | |
|---|---|
| Base SHA | `384722294329ff35f0585277992b324892fa40b6` |
| Base branch | `codex/complete-build-source-of-truth` (base SHA was its exact tip) |
| Claude branch | `claude/enterprise-ui-pilot` |
| Final Claude SHA | see `git rev-parse claude/enterprise-ui-pilot` — recorded in the PR body |
| Worktree | `.claude/worktrees/enterprise-ui-pilot` |
| PR target | `codex/complete-build-source-of-truth` (**not** `main`), opened as **draft**, not merged |

The branch was created directly at the base SHA and verified with
`git merge-base --is-ancestor`. No rebase onto another UI branch, no merge, no
deploy.

## 2. Scope actually delivered

The brief is scoped at one to two focused days. This was one session, and per
the product owner's direction it went **depth-first on Priority A** rather than
thin breadth. What that means concretely is in §8 and §9 — read those before
planning integration, because the honest answer is that most of Priority A did
not need changing and the work concentrated where real defects existed.

## 3. Environment discipline

The only pre-configured `.env.local` in the primary checkout points at Supabase
project `egjssfcenboalijfdmsi`, which is **production**. It was never used.

Verification ran against **staging** (`bncwjibscptgijgmuhrn`), from env files the
product owner supplied, copied into the worktree as gitignored local files after
confirming, without printing any secret material:

- `CONTENTGATE_SUPABASE_PROJECT_REF=bncwjibscptgijgmuhrn` ✓
- `CONTENTGATE_ENVIRONMENT=staging` ✓
- `CONTENTGATE_ALLOW_PRODUCTION_ONBOARDING` not enabled ✓
- no reference to `egjssfcenboalijfdmsi` in either file ✓

Local server on `http://localhost:3200` from this worktree (process cwd
confirmed). No production or staging **data was modified**: the audit harness
signs in and reads, and never submits a form, generates, saves, approves,
exports, or provisions. No destructive onboarding, cleanup, or production test
was run.

One incident worth recording: two early `preview_start` calls resolved to the
wrong `launch.json` config and briefly started a dev server from a checkout
carrying the production `.env.local`. Both were stopped within seconds and only
issued reads (a `/login` GET and an auth session check). No writes occurred. The
config file was restored to its committed state.

## 4. How verification was done

Two independent mechanisms, both against staging on localhost:3200.

**a. The repository's own E2E accessibility gate**

```
npx playwright test tests/e2e/app-surface.spec.ts --grep 'public surface accessible|automated accessibility gate|primary route reflowable|modal and mobile-navigation|keyboard sign-in'
```

5 passed before the changes and 5 passed after. Credentials stayed inside the
Playwright harness; they were never typed into a form by hand.

**b. A read-only audit harness** (not committed; lived in a gitignored path)

Signs in once, then walks 15 routes across the five required viewports —
1280×800, 1366×768, 1440×900, 390×844, 320×800 — capturing per combination: a
screenshot, axe-core violations at wcag2a/2aa/21a/21aa/22aa, document scrollWidth
vs clientWidth, elements crossing the viewport edge, `h1` count, heading-level
skips, landmark counts, controls with no accessible name, disabled controls, and
console/page errors.

**Final sweep: 75/75 route × viewport combinations — 0 axe violations, 0
horizontal overflow, 0 route errors, 0 console errors.**

## 5. Commits

| SHA | Commit |
|---|---|
| `9d0a0c2` | `ui: complete enterprise Studio presentation` |
| `0286650` | `ui: improve operator onboarding and authentication` |
| `7a2085b` | `ui: refine content approval and export states` |
| `9e70261` | `ui: refine product campaign and knowledge workspaces` |
| `0d37d1e` | `fix: close responsive and accessibility UI gaps` |
| `c3dd84d` | `fix: stop the operator package builder mismatching on hydration` |

No formatting-only churn is mixed into any of them.

## 6. Files changed

```
src/app/(app)/onboarding/environment-banner.tsx     (new)
src/app/(app)/onboarding/onboarding-workflow.tsx
src/app/(app)/onboarding/package-builder.tsx
src/app/(app)/studio/studio-toolbar.tsx             ** shared-risk **
src/app/(app)/studio/studio-workspace.tsx           ** shared-risk **
src/app/(app)/studio/studio-fields.tsx              ** shared-risk **
src/app/(app)/content/page.tsx
src/app/(app)/products/page.tsx
src/app/(app)/templates/template-ops-actions.tsx
docs/CLAUDE_ENTERPRISE_UI_HANDOFF_2026-07-31.md     (new)
docs/evidence/claude-enterprise-ui-2026-07-31/*.png (new)
```

## 7. Shared-risk surface — read this before integrating

`codex/wip-snapshot-20260731` (local, unpushed, at `bedbd74`) diverges from the
base and differs in **127 `src/` files**, including all three Studio files above.
If that work lands, these three commits will conflict. Every Studio change is
presentation-only and confined to `9d0a0c2`, so it can be re-applied or dropped
as one unit without unpicking anything else.

**Every interaction changed in Studio, exhaustively:**

1. Export button *wording* — three cases now read differently: "Download
   original design …" (stage shows the untouched template), "Download draft …"
   (draft QA proof), "Export approved …" (approved export). Previously the first
   and third both read "Export …".
2. The locked-export reason moved from a `title` attribute into visible text
   beneath the action, still referenced by `aria-describedby`.
3. The export bar wraps instead of forcing a 260px minimum on narrow viewports.
4. An empty required copy field renders in neutral type reading `0/24 · required`
   instead of red `0/24 · needs edit` with a red border.

**Explicitly NOT changed, verified by reading each:** generation request
payloads, autosave sequencing, optimistic locking, fit-validation logic
(`hasIssues` still governs submission exactly as before), evidence validation,
review transitions, revision semantics, export eligibility (`downloadDisabled`
and `draftPreviewDownloadAllowed` are byte-identical), the 50% scale floor, the
fit/50%/100% zoom behaviour, and canvas overflow/scroll contracts.

The 320px Studio canvas clipping seen in screenshots is the **intended** 50%-floor
plus scrollable-stage contract, not a defect. It was deliberately left alone.

## 8. Findings and what was done

### Fixed

| # | Sev | Finding | Where |
|---|---|---|---|
| 1 | P1 | Operator console gave no page-level signal of target environment; production looked identical to staging. Target was named only in body copy inside stage 2. | `onboarding` |
| 2 | P1 | Every row in the content ledger repeated the campaign name as its most prominent text — under a heading already naming that campaign — while the one distinguishing attribute (format) was truncated to "Instagram P…". | `content` |
| 3 | P1 | Locked-export reason lived in a `title` on a disabled button: unfocusable by keyboard, invisible on touch. | Studio |
| 4 | P1 | An untouched template preview offered "Export PNG" — the same words as a governed approved export. | Studio |
| 5 | P2 | Empty required fields presented as errors (red, "needs edit") before the author typed anything. | Studio |
| 6 | P2 | Template bundle import left both actions disabled with no stated reason. | `templates` |
| 7 | P2 | React hydration attribute mismatch on every `/onboarding` load, from `crypto.randomUUID()` in SSR'd `useState` initialisers. Pre-existing at base SHA. | `onboarding` |
| 8 | P3 | Product cards read "1 templates". | `products` |

### Considered and deliberately not changed

- **Ask composer's disabled "Ask" button.** Adjacent to an empty, labelled
  textarea whose placeholder reads "Ask a question…". Self-evident; adding text
  would be the decorative churn the brief warns against.
- **Package builder "Remove user/product 1" disabled at one row.** The constraint
  (a package needs at least one) is evident from there being a single row.
- **"Add approved claim" disabled.** Already explained by adjacent text — "Add an
  approved source before adding claims." My detector flagged it because it only
  inspected `title`/`aria-describedby`; a false positive, correctly implemented
  already.
- **Shell and navigation.** Audited at all five viewports: one `h1` per route,
  one `main`, no heading-level skips, no unnamed controls, correct role-gated
  sections (Admin, Platform), working mobile drawer with focus trap, Escape
  handling and focus restoration, working skip link. No defect found, so no
  commit was made against it. The prescribed commit 1 is intentionally absent.

## 9. Not covered — do not read this branch as more than it is

- **Priority A routes not individually re-styled:** `/login`,
  `/forgot-password`, `/reset-password`, `/welcome`, `/dashboard`,
  `/products/[id]`, `/products/[id]/edit`, `/products/new`, `/knowledge`,
  `/knowledge/new`, `/knowledge/[id]`, `/assets`, `/approvals`,
  `/content/[id]`, `/studio/[contentId]`. They were audited (clean on axe,
  overflow, structure) and read, but received no design changes because no
  defect justified one. They have **not** had a subjective enterprise-polish pass.
- **States never exercised live:** generation in flight, rate-limited generation,
  save failure and recovery, export progress/failure/success, approval and
  rejection transitions, rejected-note display, approved-snapshot vs current
  draft. Exercising these requires mutating staging data, which was out of
  bounds. Their code paths were read; their rendered appearance is unverified.
- **Roles never seen:** all verification ran as one admin + platform-operator QA
  account. Member, author, and approver views — and the "members do not receive
  admin controls" / "approvers do not receive workspace management" rules — were
  **not** visually confirmed. Route-level gating is asserted by the existing E2E
  suite, not by me.
- **Priority B/C:** `/settings`, `/ask`, `/ask/quality`, `/templates` beyond the
  one fix received audit coverage only.
- **Contrast** was reasoned about from the token values and passes axe, but no
  manual contrast audit was performed against every state.

## 10. Backend requirements for Codex

1. **Revision is not available on the content listing row.** §14 requires
   revision to be visible alongside title, product, campaign, format, author and
   status. `FlattenedContentRow` (`src/lib/content-listing-shared.ts`) carries no
   revision field and `contentListSelect` does not query one. Surfacing it needs
   a query and type change in Codex-owned code. Until then, two pieces in the
   same campaign, format and language are distinguishable only by status, owner
   and date.

2. **`.env.local` in the primary checkout still contains `ANTHROPIC_API_KEY`.**
   Per the recorded Phase 0 decision, Anthropic was fully removed on 2026-07-20
   and must not be reintroduced. This is a stale local env var, not code, and
   env files are Codex-owned — flagging, not touching.

3. **`.claude/launch.json` is committed with `cwd` pointing at
   `/Users/debbiemelgarejo/Documents/Content Gate/contentgate`** — a different
   local checkout. Anyone running the preview from this repo starts the wrong
   tree. Left unmodified deliberately; worth a decision.

## 11. Commands run

| Command | Result |
|---|---|
| `npm ci` | clean |
| `npm run lint` | pass (before and after) |
| `npm run typecheck` | pass (before and after) |
| `npm test` | pass — 33 tests, 0 fail |
| `npm run build` | pass — all 28 routes compiled |
| `npm audit --omit=dev --audit-level=high` | **0 vulnerabilities** |
| E2E a11y/reflow gate (5 tests) | 5 passed before, 5 passed after |
| Audit harness, 15 routes × 5 viewports | 75/75 clean |

## 12. Evidence

`docs/evidence/claude-enterprise-ui-2026-07-31/`

- `before-` / `after-content__1280x800.png` — ledger row identity
- `before-` / `after-studio-new__1280x800.png` — field state and export label
- `before-` / `after-onboarding__1280x800.png` — environment banner
- `environment-tones-all-three.png` — production / not-configured / staging
  rendered together, showing they differ by icon, wording and chip and not by
  colour alone

## 13. Assumptions needing product approval

1. **Format leads a content row instead of the campaign title.** Correct when
   rows are grouped by campaign, which they are. If ungrouped or cross-campaign
   listings are added later, revisit.
2. **Audience is the best available secondary attribute** on a content row.
   Chosen because revision is unavailable (§10.1). Revisit once revision exists.
3. **An unconfigured `CONTENTGATE_ENVIRONMENT` is presented as unsafe** (amber,
   "treat it as unsafe"), not neutral. An operator who cannot confirm the target
   should not be reassured by silence — but this is a product judgement.
4. **"Export approved …"** is asserted as the wording for a governed export.
   Verified against the eligibility logic, but the phrasing is a content
   decision.
