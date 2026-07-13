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

Latest Production release on 2026-07-13:

- Pull request: `#1` (`codex/asset-library-ui`)
- Merge commit: `239db7c7249332cade358787052d818b8421c72f`
- Deployment: `dpl_Ev74i2D367mSH9QPvFSnmCvwf5Qe`
- Deployment URL: `contentgate-4ecmafiw7-debbies-projects-a8de6bb4.vercel.app`
- Production alias: `contentgate-delta.vercel.app`
- State: `READY`
- Build completed without errors.
- `/login` returned 200; unauthenticated `/assets` resolved to login; unauthenticated creative render returned 401.
- Authenticated admin `/assets` rendered the Asset Library, upload control, product/type/status/tag filters, and governed empty state.
- Authenticated `/dashboard` rendered organization counts, approval count, and recent content.
- Vercel reported no runtime error clusters and no warning/error/fatal log entries in the checked release window.

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

## Asset Library UI Local Review

Completed on 2026-07-13 against Claude Code's uncommitted UI handoff:

- Confirmed the UI reused `listProductAssets`, `uploadProductAsset`, `updateProductAssetMetadata`, and `deleteProductAsset` without changing migrations, RLS, Storage policies, service-role use, or audit behavior.
- Reproduced and fixed a URL-filter race between debounced title search and product/type/status/view changes.
- Reproduced and fixed the shared 248px sidebar squeezing phone content to 127px and causing horizontal overflow.
- Verified the corrected shell at 375x812: mobile header and drawer fit the viewport, document width equals viewport width, and body scrolling is locked while the drawer is open.
- Verified the corrected shell at 1440x900: the 248px desktop rail remains intact and the main region fills the remaining width without overflow.
- Verified the rapid combined-filter path resolves to `?q=logo&type=packshot` rather than dropping the type filter.
- `git diff --check`, `npm run lint`, `npm run test:assets`, and `npm run build` pass.
- The final local browser pass produced no new warning or error console entries.

## Asset Library UI Preview Verification

Released to Preview on 2026-07-13:

- Branch: `codex/asset-library-ui`
- Commit: `52d6abb0cbcede4ec42f3dd8edc0f8ff793eac41`
- Draft pull request: `https://github.com/darna150/contentgate/pull/1`
- Vercel deployment: `dpl_3A9W8nPQENe7YmFpTZPhNWDXx24y`
- Preview URL: `https://contentgate-qxc4qobn5-debbies-projects-a8de6bb4.vercel.app`
- State: `READY`

Authenticated admin smoke test:

- Uploaded a 1080x1080 JPEG supporting image to Apex Canine and verified its approved status, dimensions, MIME type, size, tags, and preview.
- Edited the title, alt text, description, and tags and confirmed the refreshed card and list row reflected the saved values.
- Verified title, product, type, status, and tag filters combine into the URL and the grid/list control changes the rendered layout.
- Permanently deleted the disposable asset; the filtered library returned to zero assets and no QA data remains.
- Vercel returned no warning/error/fatal runtime logs for the Preview deployment in the checked one-hour window.

Authenticated member verification completed on 2026-07-13:

- Created a temporary member in Veltara Animal Health and signed in through an isolated Preview session.
- Confirmed search and type filters synchronize to `?q=logo&type=logo`.
- Confirmed upload, edit, and delete controls are absent for the member role.
- Confirmed a direct member insert into `product_assets` is rejected by RLS with PostgreSQL error `42501`.
- Signed out and deleted the temporary Auth user; zero Auth users, profiles, Asset Library rows, and pending test records remain.

The test exposed an existing provisioning vulnerability: `handle_new_user` trusted organization and role values from user-editable metadata, while magic-link login allowed account creation by default. The release branch now:

- Sets `shouldCreateUser: false` for magic-link login.
- Requires a short-lived `private.user_provisioning` record created through the service-role-only `provision_user` RPC.
- Rejects unprovisioned self-signup and consumes the trusted record when creating the profile.
- Grants `provision_user` only to `service_role`; `anon` and `authenticated` both fail the privilege check.

## Phase 3 Product Workspace Foundation

Started on branch `codex/product-workspaces` after the Production release:

- Added a single authenticated, organization-and-product-scoped workspace loader for product profile, assets, source documents, claims, active templates, generated content, approval queue, and status counts.
- Added shared permission rules for admin, approver, and member roles plus archived-product and missing-template behavior.
- Added shared section empty-state codes and permission-aware action URLs.
- Refactored `/products/[id]` to use the shared service without changing its current interface.
- Documented the read boundary in `PRODUCT_WORKSPACE_CONTRACT.md`.
- `git diff --check`, Asset Library tests, five workspace tests, lint, and the full Next.js production build pass.
- Applies live migrations `harden_user_provisioning` and `fix_user_provisioning_handshake`.
- Verifies hostile signup is blocked and trusted member provisioning creates the intended organization/role before clean deletion.

## Phase 3 Product Workspace UI Review

Claude Code implementation reviewed on 2026-07-13:

- Branch: `codex/product-workspaces`
- UI commit: `8a09011c6180839acd53703f3ea6dfd67d1ca759`
- Draft pull request: `https://github.com/darna150/contentgate/pull/2`
- Initial UI Preview: `dpl_5SHRQo5CDNk64Ge3C6PZicxk6ZqF`
- Initial Preview state: `READY`, with no build errors or warning/error/fatal runtime logs in the checked window.
- Confirmed the five workspace views reuse `getProductWorkspace(productId)` and introduce no UI-specific Supabase queries.
- Review found that direct template detail still exposed generation/Studio outside the workspace lifecycle gate and that Knowledge Hub navigation dropped the product ID.
- Corrected template detail to consume the workspace contract, made non-active product/template views reference-only, and enforced active product status in `/api/products/generate` before knowledge/model work.
- Corrected Knowledge Hub navigation to carry and validate `?product=...`, select the newest matching session, or retain the product in a new-conversation state.
- Added inactive/archived lifecycle and product-aware Knowledge Hub regression tests.
- Local verification: `git diff --check`, eleven tests, lint, TypeScript, and the Next.js production build pass.
- Corrected Preview deployment and authenticated role QA remain pending before PR #2 can be marked ready.

Authentication hardening Preview verification completed on 2026-07-13:

- Commit: `47d5056069029fc180c4551e8c70d03a386cae9c`
- Deployment: `dpl_9aob3SNXBpGHobUvvuGntn9Y9bAf`
- Branch alias: `contentgate-git-codex-asset-li-ccfe90-debbies-projects-a8de6bb4.vercel.app`
- State: `READY`
- Unknown magic-link login was rejected with `Signups not allowed for otp`; no Auth user was created.
- A server-provisioned member signed in successfully and loaded the Veltara dashboard with role `member`.
- The member signed out and was deleted; zero Auth users, profiles, and pending provisioning records remain from the test.
- The deployment build completed successfully and no warning/error/fatal runtime logs appeared in the checked window.

All Asset Library Preview release gates now pass. Production promotion is pending PR #1 review and merge.
