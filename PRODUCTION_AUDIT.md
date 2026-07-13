# Production Audit

Last updated: 2026-07-13

## Local Repo

- Repo path: `/Users/debbiemelgarejo/Documents/Animal-Health-Hub/contentgate`
- Branch: `main`
- Local state before this pass: `main...origin/main [ahead 1]`
- Latest local commit before this pass: `d87e917 Knowledge Hub: NotebookLM-style persistent sessions + source panel`
- Current workspace folder `/Users/debbiemelgarejo/Documents/Content Gate` is not the app repo.

## Vercel

- Project: `contentgate`
- Project ID: `prj_grjyPK0Jc6Ng7ojBzHRXSOxGaxDL`
- Team/org ID: `team_icRkOOve7nNBj9BSVphsBp84`
- Framework: Next.js
- Node version: `24.x`
- Latest production deployment inspected: `dpl_DRWQokqrr4A3uuFUgyYz69fBW1wn`
- Latest production URL inspected: `contentgate-6z11g7ozj-debbies-projects-a8de6bb4.vercel.app`
- Latest production commit: `d87e917509e00845e088b1240832ea7297fb7b27`
- Production domains listed by Vercel:
  - `contentgate-delta.vercel.app`
  - `contentgate-debbies-projects-a8de6bb4.vercel.app`
  - `contentgate-darna150-debbies-projects-a8de6bb4.vercel.app`

Production was subsequently updated from GitHub `main`:

- Deployment: `dpl_67BiwHMDvh2gLMLHxjbdJd8u61zc`
- Deployment URL: `contentgate-era97sf0w-debbies-projects-a8de6bb4.vercel.app`
- Production alias: `contentgate-delta.vercel.app`
- Commit: `a5a17f520182d892cd852230d00c60982a17393a`
- State: `READY`
- Post-deploy checks: login 200, unauthenticated dashboard redirected to login, unauthenticated render returned 401, and no warning/error/fatal runtime logs appeared in the checked one-hour window.

## Preview Deployment

Security/API hardening from this pass was deployed to Vercel Preview, not Production:

- Preview deployment ID: `dpl_szJ3Y36gxDuYfG5Lwnuc7M1D3CWt`
- Preview URL: `https://contentgate-qk5bhjj3i-debbies-projects-a8de6bb4.vercel.app`
- Inspector: `https://vercel.com/debbies-projects-a8de6bb4/contentgate/szJ3Y36gxDuYfG5Lwnuc7M1D3CWt`
- Target: Preview
- Source: Vercel CLI with local dirty worktree

Preview env status:

- `NEXT_PUBLIC_SUPABASE_URL` exists for Preview.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` exists for Preview.
- `SUPABASE_SERVICE_ROLE_KEY` exists for Preview.
- `ANTHROPIC_API_KEY` exists for Preview.

Preview smoke checks completed:

- `/login` returned 200.
- Unauthenticated `/dashboard` resolved to the login page.
- Unauthenticated `/api/creative/render?content=00000000-0000-0000-0000-000000000000&size=square` returned 401.
- Vercel reported no error/fatal runtime logs for this preview deployment in the 24-hour window checked on 2026-07-08.

## Runtime Errors

Vercel reported two runtime error groups in the last seven days, both on `/middleware` and both on 2026-07-06:

- `TypeError: fetch failed`
- `AuthRetryableFetchError: fetch failed`

The underlying cause shown by Vercel was DNS resolution failure for the configured Supabase host. This should be monitored after redeploying security changes. If it recurs, inspect Supabase project status, Vercel environment values, and network/runtime logs.

## Local Environment

`.env.local` exists locally with these keys:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

No secret values are recorded in this repo.

## Local Verification

Completed on 2026-07-08:

- `git diff --check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- Vercel Preview runtime logs after live Supabase restore/migration: no error/fatal logs in the checked 2-hour window for deployment `dpl_szJ3Y36gxDuYfG5Lwnuc7M1D3CWt`.

Dependency audit on 2026-07-13:

- No high or critical production dependency advisories.
- Two moderate advisories are reported through Next.js's bundled PostCSS.
- npm offers an incompatible Next.js downgrade rather than a valid patched upgrade, so no automated audit fix was applied.

## Gaps To Resolve

- Add a true staging/preview branch workflow before larger feature work.
- Confirm production Supabase migrations are applied after this pass.
- Add CI for build, lint, and template render checks.
- Decide whether production should stay on automatic deploys from `main` or require a reviewed promotion step.

## Supabase Migration Status

Claude Code applied `supabase/migrations/20260706000001_harden_approval_security.sql` to the live ContentGate Supabase project on 2026-07-08 after restoring the project from paused/inactive to `ACTIVE_HEALTHY`.

Verified live database changes:

- `protect_profile_membership_fields` trigger exists on `profiles`.
- `authenticated` has profile update access only for `full_name`.
- New admin-only document table policies exist.
- New admin-only document and product asset storage write policies exist.
- New generated-content policies require draft-only client inserts/updates with null approval fields.
- Superseded permissive policies were removed.
- No migration errors were reported.

## Authenticated Workflow Verification

Completed on Vercel Preview on 2026-07-12 using an existing VitalBite draft:

- Draft content did not expose export controls.
- Submit for review moved the record to `in_review` and added it to the approval queue.
- Rejection required and stored a reviewer note, returned the record to `rejected`, and removed it from the queue.
- Resubmission returned the record to `in_review`.
- Approval stored the approver/date, removed the record from the queue, and exposed approved export controls.
- The approved content-to-Studio handoff initially revealed a context bug: `/studio?content=...` fell back to the default Apex Canine template.
- The handoff was fixed so the content record is the canonical product/template context and export links include all three IDs.
- Corrected preview deployment `dpl_6kg4vyNbytRHzXZBmc3WrdUoPGGz` loaded the approved VitalBite content in Generated mode with the correct copy and enabled PNG/JPEG/PDF export controls.
- No browser console warnings/errors or Vercel warning/error/fatal runtime logs were observed for the corrected preview during the test window.

Browser automation did not surface a file-download event for the Markdown or live-canvas PNG buttons. Both controls remained available without a UI or console error, but the resulting local file transfer should be confirmed manually before production promotion.

Debbie subsequently confirmed that both Markdown and PNG files downloaded and opened correctly before the production push.

## Asset Library Database Foundation

Applied to live Supabase project `egjssfcenboalijfdmsi` on 2026-07-13:

- `asset_library_foundation`
- `asset_library_policy_indexes`
- `harden_asset_storage_listing`
- `allow_admin_asset_storage_read`

Verified:

- All metadata columns, constraints, indexes, and the update timestamp trigger exist.
- Asset reads are organization-scoped; inserts, updates, and deletes are explicit admin-only policies.
- Admin insert passed inside a rolled-back RLS transaction; an unauthorized identity was rejected.
- No policy test rows remain.
- Storage inspection/upload/delete remains admin-only and organization-folder-scoped.
- Public bucket enumeration was removed while public object URLs remain available.
- Supabase security advisor reports no Asset Library warnings after the changes.

## Asset Library Production Verification

- Commit: `e20da6fe0e35cf69d26d72a8d04831b07c3080e6`
- Deployment: `dpl_4qzkufrnNnGbLnSEhdHNSkLNGzB9`
- URL: `contentgate-2x6e2i49x-debbies-projects-a8de6bb4.vercel.app`
- Production alias: `contentgate-delta.vercel.app`
- State: `READY`

Authenticated admin smoke test on 2026-07-13:

- Uploaded a generated 96x64 PNG as a supporting image.
- Verified title, normalized tags, MIME type, 321-byte size, dimensions, approved status, organization/product path, and preview.
- Edited title, alt text, description, tags, and status from approved to pending.
- Verified `product_asset.created` and `product_asset.updated` audit events and previous-value details.
- The first delete removed the metadata row but exposed that the Storage API also needs scoped `SELECT` visibility to resolve an object before deletion.
- Applied `allow_admin_asset_storage_read`, removed the one orphaned temporary object through the Storage API, and reran the complete upload/delete path.
- Final verification returned zero asset rows, zero Storage objects, and one delete audit event for the second test asset.
- No temporary Asset Library rows or files remain.
- Supabase security advisor reports no Asset Library warnings; only expected fresh-index `unused_index` informational notices remain.
- Vercel reported no runtime error groups and no warning/error/fatal logs for the deployment in the checked one-hour window.
