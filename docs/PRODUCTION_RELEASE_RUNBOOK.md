# ContentGate production release runbook

This runbook promotes one already-certified commit. It does not authorize a
launch, certify legal compliance, or permit production data cleanup. The named
go/no-go approver remains accountable for the launch decision.

## Release identities

- Repository: `darna150/contentgate`
- Release PR: `#58`, targeting `main`
- Staging Supabase project: `bncwjibscptgijgmuhrn`
- Production Supabase project: `egjssfcenboalijfdmsi`
- Production domains: `contentgate.app`, `www.contentgate.app`, and
  `contentgate-delta.vercel.app`
- Vercel project: `prj_grjyPK0Jc6Ng7ojBzHRXSOxGaxDL`

Record the candidate SHA, Preview deployment ID and URL, previous healthy
Production deployment ID, database backup/PITR timestamp, release operator,
and named approver in the release record before changing production.

## Stop conditions

Stop the release if any of these is true:

- the tested SHA is not the PR head being merged;
- any required GitHub, Vercel, migration replay, tenant-isolation,
  deterministic browser, live-AI, accessibility, or role-boundary gate failed;
- Supabase reports a security `ERROR` or a new unexplained warning;
- production backup or point-in-time recovery is unavailable;
- environment variables, Auth redirect URLs, SMTP delivery, or the production
  domain are not confirmed;
- the previous healthy Vercel deployment is not recorded as a rollback target;
- client acceptance or the named production approver is missing.

## Candidate gates

Run every gate against the same commit:

1. `npm ci`, production dependency audit, lint, typecheck, unit/contracts, and
   production build.
2. Clean replay of all canonical migrations followed by the permanent
   two-tenant isolation test.
3. Deterministic Playwright lane against the exact Vercel Preview.
4. Credentialed live-AI lane against that Preview, including grounded Ask,
   generation, refinement, review, approval, and export.
5. Disposable onboarding, password recovery, admin/approver/member boundaries,
   responsive viewport matrix, and axe checks.
6. Exact-deployment Vercel error/fatal scan and Supabase Auth/API/Postgres log
   review.

Stateful E2E is forbidden against production. The production Ask validation is
a separately marked post-deploy workflow and must not be used as a substitute
for Preview acceptance.

## Production database preflight

The canonical staging ledger contains 85 exact migrations. Production has a
historical 71-entry ledger: only 8 entries use the same version and name, while
55 implemented migrations have the same semantic name under older timestamps.
Do **not** run an unreviewed `supabase db push`; it would treat already-applied
history as pending.

The July 31 read-only schema comparison found a narrow structural difference.
Production lacks only the onboarding/campaign control-plane structures:

- `public.campaigns` and `campaign_id` on `generated_content`;
- workspace/product/document/claim/asset portable key columns;
- `public.onboarding_runs`, `public.onboarding_run_steps`, and
  `public.onboarding_package_uploads`;
- `private.onboarding_user_provisioning`;
- protected onboarding RPCs and the provisioning-aware `handle_new_user()`.

Before the app promotion, apply and review these additive canonical migrations
in order, preferably first on a production-derived Supabase branch:

1. `20260730142808_one_click_onboarding_control_plane.sql`
2. `20260730142907_onboarding_fk_indexes.sql`
3. `20260730144321_fix_onboarding_org_id_ambiguity.sql`
4. `20260730144438_fix_onboarding_retry_run_id_ambiguity.sql`
5. `20260730144615_rename_onboarding_tenant_variables.sql`
6. `20260730150146_onboarding_campaign_fk_indexes.sql`

Do not apply `20260731052439_dispose_completed_staging_onboarding.sql` to
production. It is a staging cleanup capability, not a product dependency.

After applying the six migrations:

- repeat the table/column/function comparison;
- run Supabase security and performance advisors;
- verify Auth user creation still invokes the provisioning-aware trigger;
- run tenant isolation and onboarding contract tests;
- keep `CONTENTGATE_ALLOW_PRODUCTION_ONBOARDING` disabled.

Historical ledger convergence is separate maintenance. Do not rewrite old
migration files or repair dozens of production ledger entries during launch.

## Application promotion

1. Freeze changes and record the accepted PR head SHA.
2. Confirm every required check belongs to that SHA.
3. Merge PR #58 into `main` only after named approval.
4. Wait for Vercel to report the matching `main` deployment `READY`.
5. Confirm `contentgate.app` and `www.contentgate.app` resolve to that deployment.
6. Run `npm run smoke -- https://contentgate.app`.
7. Run the marked Ask production validation and the approved pilot acceptance
   journey with dedicated accounts.
8. Review runtime errors, error/fatal logs, `/api/health`, Supabase Auth/API/
   Postgres logs, and Ask quality telemetry for the new SHA.
9. Keep onboarding disabled until a separately reviewed client package and
   exact production confirmation are approved.

## Rollback

For an application-only failure, immediately route the domains back to the
recorded previous healthy Vercel deployment. Confirm the alias change, rerun the
production smoke, and record the incident window.

The onboarding schema changes are additive. If the app is rolled back, leave
the added tables and columns in place and keep production onboarding disabled.
Do not attempt a launch-time down migration.

If a future production onboarding run fails, use its audited compensation path
and immutable run receipt. Never delete tenant, Auth, or Storage records ad hoc.
Escalate before acting if compensation cannot prove its exact run scope.

## Support and escalation

| Severity | Definition | Initial action |
| --- | --- | --- |
| P0 | Cross-tenant read/write, export before approval, unsupported claim presented as verified, credential exposure, or unrecoverable data loss | Disable affected capability, rollback application, preserve evidence, notify the release owner immediately |
| P1 | Core sign-in, generation, review, approval, export, or onboarding journey unavailable with no safe workaround | Halt rollout, inspect exact-deployment logs, assign an owner and recovery time |
| P2 | Degraded performance, isolated safe model refusal, or non-blocking UX defect | Record with evidence and schedule without weakening a control |

The release record must name the engineering incident owner, client-contact
owner, and production go/no-go approver. Role labels alone are not final
signoff.
