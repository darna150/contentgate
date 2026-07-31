# ContentGate complete-build source of truth

Status date: July 31, 2026

This record supersedes every earlier branch, worktree, UI audit, and release
handoff. It answers one question: which tree contains the complete build that
must be certified before launch?

## Canonical release candidate

- Repository: `darna150/contentgate`
- Integration base: `origin/main` at `29c5e2a`
- Candidate branch: `codex/complete-build-source-of-truth`
- Candidate worktree:
  `/Users/debbiemelgarejo/Documents/Content Gate/contentgate-phase1-accessibility`
- Production remains unchanged. This branch must pass the PR preview gates and
  receive named go/no-go approval before it may be merged into `main`.
- After that merge, `main` becomes the sole build source of truth. Feature work
  must branch from that merged commit, not from any worktree or older release
  branch listed below.

## What is consolidated

The candidate starts from the latest `main` UI/UX and adds the release work that
existed only in the other Codex and Claude lines:

- current ContentGate navigation, product workspace, Ask, Brand Knowledge, and
  campaign UI from `main`;
- one-click workspace package building, transactional provisioning, rollback,
  resumability, setup email, guarded staging disposal, and operator controls;
- password recovery, server-verified onboarding, authenticated route handling,
  and role-aware landing behavior;
- Nimbus Studio and its 42-format bundle, static reference previews, product
  asset choices, editable/generated copy contracts, generation grounding,
  retry and repair behavior, revision semantics, campaign continuity, and
  revision/export safeguards;
- Studio Fit / 50% / 100% controls, a 50% readable scale floor, scrollable
  overflow, and signed-in viewport coverage for story, A4, portrait, and poster;
- DAM media, versioning, health, download, preview, and approval controls;
- product campaign display and persistence, template import/preflight/publish
  operations, document source URLs, Ask production telemetry, and client brand
  voice;
- accessibility fixes for focus visibility, tabs, dialogs, heading hierarchy,
  contrast, route coverage, and credentialed axe/browser gates;
- CI verification, clean migration replay plus tenant isolation, preview E2E,
  production smoke, and manual live-QA workflows.

## Branch and worktree disposition

- `origin/claude/studio-reflow-scale-floor` at `207c7ad` is fully represented by
  this candidate. It is not a future merge base.
- `codex/one-click-onboarding-staging` at `40c377d` and PR #57 are superseded by
  this candidate. Their earlier credentialed evidence remains historical
  evidence only because it exercised a different UI/build.
- The previously dirty checkout was preserved without loss as local branch
  `codex/wip-snapshot-20260731` at `bedbd74`. Its intended Nimbus, Studio,
  generation, revision, and DAM work is integrated here. The snapshot itself
  is recovery material, not a release branch.
- Duplicate or older template contracts that would restore obsolete Set A or
  ten-format Aerform assumptions were intentionally not imported. The candidate
  keeps the current five-format legacy runtime and the 42-format Nimbus runtime.
- The stale marketing report from the dirty snapshot was not imported because
  it was written against an older baseline.

## Migration decision

The candidate contains 85 canonical migration files. A read-only comparison
against staging project `bncwjibscptgijgmuhrn` found an exact 85-for-85 ordered
match: no local-only and no staging-only versions.

The Ask production telemetry migration is canonical at
`20260728093230_ask_production_quality_telemetry.sql`. The competing file had
the same SQL behavior with comment-only differences, so it was not added as a
second migration. No database write was required during consolidation.

## Certification evidence

Local candidate gates completed on July 31, 2026:

- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm test` — pass, including 85 migration files, 42 Nimbus variants, tenant
  and onboarding contracts, Ask/knowledge, assets, approval, generation,
  templates, rendering, UI, revision, and Studio scale tests
- `npm run build` — pass on Next.js 16.2.12; all 34 static pages generated
- `npm audit --omit=dev --audit-level=high` — zero production vulnerabilities
- React quality review — no new blocking waterfall, cleanup, hook, image, or
  hydration finding; raw preview images remain intentional pixel-exact canvases

Staging’s migration ledger is synchronized. Supabase advisors currently report
no `ERROR` findings, plus pre-existing warnings for eight authenticated
security-definer functions and leaked-password protection, and informational or
performance findings for service-only RLS tables, indexes, policies, and Auth
connection allocation. These remain visible hardening inputs; they were not
created or altered by this consolidation.

## Remaining launch gates

The build is locally certified, but launch is not approved until the exact PR
head completes all of the following:

- GitHub `verify` and clean migration replay/tenant isolation;
- Vercel Preview deployment for the exact candidate SHA;
- credentialed Playwright and axe suite against that Preview, including the
  Studio viewport matrix;
- representative admin/member product → knowledge → asset → campaign →
  generation → review → approval → approved-only export journey;
- exact-candidate log review, rollback/support check, and named go/no-go signoff.

## Release rule

Do not integrate an audit from another UI and call it acceptance. Evidence is
valid for launch only when its tested SHA equals the PR head being approved.
Merge only this certified PR into `main`; do not separately merge the
superseded branches afterward.
