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
  operations, org-scoped generic bundle installation and asset-path repair,
  document source URLs, Ask production telemetry, and client brand voice;
- accessibility fixes for focus visibility, tabs, dialogs, heading hierarchy,
  contrast, route coverage, and credentialed axe/browser gates;
- CI verification, clean migration replay plus tenant isolation, preview E2E,
  production smoke, and manual live-QA workflows.

## Release-gate stabilization

Commit `6ad1d35` separates the credentialed browser evidence into two explicit
lanes without reducing launch scope:

- 19 deterministic route, authorization, asset, accessibility, responsive,
  content-ledger, and Studio viewport tests remain required on every PR;
- 7 live provider tests cover grounded Ask, generation, refinement, fit,
  review, approval, and export as separately run launch evidence.

The `6ad1d35` Preview passed verify, clean migration replay/tenant isolation,
Vercel deployment, all 17 configured deterministic checks, and all 7 live-AI
checks. Two operator-onboarding checks correctly remained skipped because their
disposable package inputs are supplied only during the dedicated onboarding
gate. Independent read-only route scenarios now use four workers, reducing the
deterministic browser runtime from 4.0 to 2.5 minutes in the local exact-Preview
benchmark.

An executable Playwright global guard now refuses every ContentGate production
hostname unless the CI-only, marked Ask production-validation job is running.
Expected 422 model-safety refusals are warnings so they no longer pollute fatal
runtime monitoring; actual provider and application failures remain errors.

The production migration ledger is historical and must not receive a blind
canonical `db push`. Read-only structural comparison shows production is
otherwise aligned but lacks the additive onboarding/campaign control plane.
The exact six-migration promotion sequence and rollback rules are recorded in
`docs/PRODUCTION_RELEASE_RUNBOOK.md`.

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
second migration. No schema migration was required during consolidation.

## Release data source of truth

The new staging project was initially only a disposable accessibility fixture;
it was not the environment where the Nimbus demo had been built. The established
demo in Supabase project `egjssfcenboalijfdmsi` was therefore used as a read-only
reference for release data. That source remains unchanged.

The preview/staging project is `bncwjibscptgijgmuhrn`. Its release-facing state
is now:

- workspace `ContentGate Demo`;
- product `Nimbus 1`;
- active campaign and template family `Nimbus Air Campaign`;
- published template version `figma-full-v7`, with 42 variants and 217
  canonical org-scoped template assets;
- five approved Nimbus product/background assets, four approved fictional
  sources, and seven source-linked approved claims;
- the existing credentialed fixture IDs retained so CI and reviewer links stay
  stable.

The disposable Accessibility QA template family/version was retired. Its 58
visible test outputs were migrated to the Nimbus version and campaign with no
Accessibility QA or Aerform labels remaining. Their immutable audit history was
preserved rather than bypassing the database history guard. No Aerform family,
assignment, or campaign exists in the release-facing staging state.

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
- credentialed Nimbus generation/edit journey — pass against the exact Preview
- credentialed data-backed route, axe, mobile reflow, and touch-target gate —
  pass locally against the corrected Nimbus staging data
- Studio viewport matrix — pass at 1366×768, 1280×800, and 1440×900 with
  measured scales of 50.0%, 50.0%, and 58.4%

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

The detailed current status, security findings, production configuration gates,
and compliance boundary are in
`docs/PILOT_RELEASE_READINESS_2026-07-31.md`.

## Release rule

Do not integrate an audit from another UI and call it acceptance. Evidence is
valid for launch only when its tested SHA equals the PR head being approved.
Merge only this certified PR into `main`; do not separately merge the
superseded branches afterward.
