# ContentGate release consolidation

Status date: July 31, 2026

This is the current release-control record for the initial client launch. It
supersedes branch, worktree, and launch-status notes in older handoffs.

## Release scope

- Worktree: `/Users/debbiemelgarejo/Documents/Content Gate/contentgate-phase1-accessibility`
- Release branch: `codex/one-click-onboarding-staging`
- Integration base: `origin/main`
- Recovery branch: `codex/backup-one-click-onboarding-pre-consolidation-20260731`
- Production domain: `https://contentgate.app`

The primary checkout at `/Users/debbiemelgarejo/Documents/Content Gate/contentgate`
is a separate dirty feature checkout and is not part of this release operation.

## Codex/Claude execution timeline

### Day 1 — baseline and scope lock

- [x] Identify the intended release worktree and branch.
- [x] Preserve the pre-consolidation state on a recovery branch.
- [x] Inventory the tracked and untracked work without discarding changes.
- [x] Separate the release work into onboarding, authentication, accessibility,
  and operating-documentation scopes.
- [x] Establish P0/P1/P2 release criteria from the completion definition.
- [x] Run the pre-merge unit, type, lint, accessibility-contract, and onboarding
  baselines.

### Day 2 — consolidate the release candidate

- [x] Commit the reviewed onboarding package-builder and provisioning workflow.
- [x] Commit server-verified setup and password-recovery handling.
- [x] Commit the signed-in accessibility and full-route E2E gate.
- [x] Commit launch ownership, onboarding, and support runbooks.
- [x] Merge the current `origin/main` into the release branch.
- [x] Incorporate Ask production-quality telemetry and website knowledge imports.
- [x] Preserve document approval controls while adding website source URLs.
- [x] Collapse the duplicate Ask telemetry migration into one canonical migration.
- [x] Complete retirement of the obsolete Set A template and assets while keeping
  the newer Aerform/Nimbus Set B runtime.
- [x] Align CI, live E2E environment names, package scripts, and the dependency
  lock.
- [x] Verify the consolidated tree with the full test suite, TypeScript, ESLint,
  the production dependency audit, and a Next.js 16.2.12 production build.

### Day 3 — publish a staging release candidate

- [x] Push the release branch and open the review PR.
- [x] Run remote CI and inspect every workflow result.
- [x] Deploy the preview/staging release candidate.
- [x] Reconcile the 85-file migration chain with the intended staging Supabase
  project and apply the one pending retirement migration.
- [x] Confirm the staging environment variables and operator allowlist.

### Day 4 — execute credentialed staging gates

- [x] Complete signed-out, expired/reused-link, and existing-session recovery QA.
- [x] Build, inspect, preflight, and provision a realistic disposable onboarding
  package through the signed-in operator UI.
- [x] Verify setup emails and the admin, approver, and member landing boundaries.
- [x] Replay the identical package and confirm that no duplicate tenant is created.
- [x] Exercise a failed package and confirm that no tenant, Auth, or Storage residue
  remains.
- [x] Run guarded disposal and confirm that the immutable run receipt remains.

### Day 5 — complete launch acceptance

- [ ] Run admin/member UAT for product, campaign, knowledge, asset, template,
  generation, review, approval, and approved-only export.
- [ ] Run the signed-in accessibility/browser suite at 1366×768, 1280×800, and
  1440×900, including the 1080×1920 story acceptance criterion.
- [ ] Review staging logs, Ask quality gates, rollback steps, and support routing.
- [ ] Record client acceptance and the named production go/no-go approver.

## Current release findings

### P0 — production blockers

There are no open P0 findings from the Day 1–4 consolidation and credentialed
staging work. This does not close the Day 5 production acceptance gate.

### P1 — required before go-live

- Complete the representative generate → review → approve → export acceptance
  journey and responsive/accessibility browser matrix.
- Confirm the Studio scale-floor/scroll work across story, A4, portrait, and
  poster at the required viewports.
- Review staging logs, Ask quality gates, rollback readiness, support routing,
  and obtain named production go/no-go approval.

### P2 — follow-up or tooling clarification

- `npm audit --omit=dev --audit-level=high` passes with zero production
  vulnerabilities. A full development-dependency audit currently reports the
  `brace-expansion` advisory even though the installed dependency tree resolves
  patched `brace-expansion` 1.1.18 and 5.0.9; confirm the advisory result again in
  remote CI when the registry metadata settles.
- Supabase security advisors report no errors. Warnings remain for authenticated
  security-definer functions and disabled leaked-password protection; review
  those as a post-candidate hardening task unless policy makes them go-live gates.
- Defer the broad half-pixel/type-scale cleanup until after launch; it is not a
  safe release-branch sweep.

## Staging evidence

- Review PR: `https://github.com/darna150/contentgate/pull/57`.
- Staging application candidate: commit `a81b9ac`, deployed at
  `https://contentgate-3yxpp55v8-debbies-projects-a8de6bb4.vercel.app`.
- GitHub verify and tenant-isolation jobs passed after replaying all 85 migrations
  in a fresh local Supabase stack. The preview browser gate is enforced on every
  release-branch update.
- Staging migration history is synchronized. The only pending release migration,
  `20260728064953_retire_contentgate_local_friendly.sql`, was applied; queries
  confirmed no active legacy family, version, assignment, or product template.
- Disposable onboarding run `3eba015e-b3a0-45d4-924e-88f11c94bdf6` provisioned
  2 users, 1 product, 1 campaign, 1 approved document, 1 approved claim, 1
  approved asset, 1 active template assignment, and 60 storage objects.
- Replaying the identical ZIP returned the same run and tenant. A deliberate
  identity collision rolled back with no tenant, Auth, or Storage residue.
- The operator receipt reported both setup emails sent. Admin, approver, and
  member navigation boundaries were browser-verified.
- Recovery passed for signed-out request, valid link, reused-link rejection, and
  an existing authenticated session; the replacement password signed in.
- Guarded staging disposal removed 2 Auth users and 60 storage objects. The
  completed receipt/report remains immutable, the failed run remains
  `rolled_back`, and final residue checks returned zero.
- Temporary browser sessions, package ZIPs, screenshots, environment exports, and
  helper scripts were removed after the durable evidence was recorded.

## Verified local gates

- `npm ci --ignore-scripts`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build` on Next.js 16.2.12
- `npm audit --omit=dev --audit-level=high` — zero vulnerabilities
- Migration integrity — 85 files
- Accessibility contract — all 26 UI routes declared
- Onboarding tests — 26 passing
- Knowledge/Ask tests — 69 passing
- Template contract tests — 71 passing
- Template render tests — 33 passing

## Go/no-go rule

Do not call the build production-ready until every P0 and P1 item above is
closed with staging evidence and a named person approves the production launch.
The local consolidated tree is a release-candidate input, not a production
go-live approval.
