# ContentGate Launch Runbook

Last updated: 2026-07-13

## Release Flow

1. Create a `codex/*` or focused feature branch from current `origin/main`.
2. Open a pull request and wait for both GitHub CI and Vercel Preview checks.
3. Run authenticated Preview QA for login, dashboard, Asset Library, one product workspace, Knowledge Hub, content review, approval, and Studio export gating.
4. Rehearse every database migration inside `BEGIN`/`ROLLBACK` before applying it.
5. Merge only after checks and Preview QA pass. Vercel promotes `main` automatically.
6. Confirm the Production deployment SHA and run `npm run smoke -- https://contentgate-delta.vercel.app`.
7. Repeat the authenticated workflow checks and inspect browser, Vercel, Supabase API, Auth, and Storage logs.

Required pull-request checks:

- High-severity production dependency audit.
- Migration filename/content integrity.
- ESLint and TypeScript.
- Focused contract tests and template render tests.
- Next.js production build.
- Vercel Preview deployment.

## Phase 7 Migration Order

1. Apply `launch_readiness_security` before Preview QA. It adds the rate-limit RPC required by the new AI routes, upload restrictions, helper hardening, RLS optimizations, and indexes.
2. Apply `finalize_rate_limit_hardening`, which adds the covering actor index and an explicit deny-all direct-access policy.
3. Apply `prepare_private_asset_reads`, which lets signed-in organization members request short-lived URLs without exposing another organization's objects.
4. Apply `split_product_configuration_policies`, which replaces overlapping `FOR ALL` policies with explicit authenticated read and admin mutation policies.
5. Deploy and verify the signed-URL application build in Preview.
6. Merge and wait for the compatible Production build to reach `READY`.
7. Apply `make_product_assets_private` only after that Production build is live.
8. Recheck Asset Library images as admin and member, then verify the bucket is private.

## Production Smoke

Automated hourly and manual smoke checks verify:

- `/api/health` can reach Supabase.
- `/login` renders.
- unauthenticated `/dashboard` redirects to login.

Authenticated release checks:

1. Sign in and load the dashboard.
2. Open Asset Library in grid and list view; confirm signed images render.
3. Open a product workspace and all five tabs.
4. Ask one supported Knowledge Hub question and inspect its citation.
5. Confirm draft content has no export, in-review content has reviewer controls, and approved content has revision-specific export.
6. Open approved and draft content in Studio; only the approved exact revision may copy or download.

## Customer Onboarding

ContentGate uses controlled provisioning; public signup is intentionally disabled.

1. Create the organization and its initial admin through the trusted provisioning process.
2. Confirm the admin can sign in and update only their own display name.
3. Configure the organization's approved starter templates. Template creation remains a controlled implementation step until the Figma onboarding flow is finalized.
4. The customer admin can then create products, upload approved sources and assets, add claims, generate content, and manage the workflow without developer intervention.
5. Provision approver/member users with the least-privileged role needed.

## Rollback

Application rollback:

1. In Vercel, open the last known-good Production deployment.
2. Use **Promote to Production** and confirm `contentgate-delta.vercel.app` resolves to it.
3. Run the automated and authenticated smoke checks.

Database rollback:

- Migrations are additive and use forward fixes; do not run destructive down migrations on Production.
- If the signed-URL build must be rolled back to a public-URL build, temporarily set `product-assets.public = true` before promoting the old application. Record the exposure window, then restore private delivery with the compatible build.
- For data loss or corruption, stop writes, capture the incident time, and restore through Supabase Backups/PITR. A database backup does not restore deleted Storage objects, so asset recovery must be handled separately.

## Incident Triage

1. Confirm Vercel deployment state and runtime error clusters.
2. Run `/api/health` and the smoke script.
3. Inspect Supabase API, Auth, Postgres, and Storage logs.
4. Determine whether the incident is application, database, authentication, storage, or model-provider related.
5. Roll back the application or apply a forward database fix; never weaken RLS or approval/export gates to restore service.
6. Record timeline, impact, actions, and follow-up in `PRODUCTION_AUDIT.md`.
