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

- [ ] Push the release branch and open the review PR.
- [ ] Run remote CI and inspect every workflow result.
- [ ] Deploy the preview/staging release candidate.
- [ ] Apply the 85-file migration chain to the intended staging Supabase project.
- [ ] Confirm the staging environment variables and operator allowlist.

### Day 4 — execute credentialed staging gates

- [ ] Complete signed-out, expired/reused-link, and existing-session recovery QA.
- [ ] Build, inspect, preflight, and provision a realistic disposable onboarding
  package through the signed-in operator UI.
- [ ] Verify setup emails and the admin, approver, and member landing boundaries.
- [ ] Replay the identical package and confirm that no duplicate tenant is created.
- [ ] Exercise a failed package and confirm that no tenant, Auth, or Storage residue
  remains.
- [ ] Run guarded disposal and confirm that the immutable run receipt remains.

### Day 5 — complete launch acceptance

- [ ] Run admin/member UAT for product, campaign, knowledge, asset, template,
  generation, review, approval, and approved-only export.
- [ ] Run the signed-in accessibility/browser suite at 1366×768, 1280×800, and
  1440×900, including the 1080×1920 story acceptance criterion.
- [ ] Review staging logs, Ask quality gates, rollback steps, and support routing.
- [ ] Record client acceptance and the named production go/no-go approver.

## Current release findings

### P0 — production blockers

- Credentialed staging validation has not run against this consolidated commit.
- The release branch has not yet been pushed, reviewed, or deployed as a staging
  release candidate.
- Staging migrations and environment configuration have not been confirmed for
  this exact tree.

There are no known local code/test P0 failures after consolidation.

### P1 — required before go-live

- Complete operator, admin, approver, and member role-boundary journeys in staging.
- Complete the disposable onboarding/replay/failure/cleanup sequence.
- Complete real setup and recovery email journeys while signed out and with an
  existing browser session.
- Complete the representative generate → review → approve → export acceptance
  journey and responsive/accessibility browser matrix.

### P2 — follow-up or tooling clarification

- `npm audit --omit=dev --audit-level=high` passes with zero production
  vulnerabilities. A full development-dependency audit currently reports the
  `brace-expansion` advisory even though the installed dependency tree resolves
  patched `brace-expansion` 1.1.18 and 5.0.9; confirm the advisory result again in
  remote CI when the registry metadata settles.

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
