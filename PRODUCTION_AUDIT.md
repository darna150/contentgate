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
- Correction commit: `9e63a991aa0734e4564bf46fd769fefe86add33d`
- Corrected Preview: `dpl_9cnouYp7aqX1f6Fk2NRrVV6Y9Wg7`
- Corrected Preview URL: `https://contentgate-i5pr98tt6-debbies-projects-a8de6bb4.vercel.app`
- Corrected Preview state: `READY`; build completed without errors and no warning/error/fatal runtime logs appeared in the checked window.
- Unauthenticated workspace access correctly redirected to `/login`.
- Stable branch Preview: `https://contentgate-git-codex-product-bc1043-debbies-projects-a8de6bb4.vercel.app`
- Authenticated admin QA confirms all five settled VitalBite workspace views, product-scoped Knowledge Hub navigation, and inactive DigestPro generation gating with no browser console errors.
- Disposable member QA confirms generation on active configured products, read-only review access, no product administration or approval actions, and no inactive-product Generate or Studio control.
- Disposable approver QA confirms generation on active configured products, Approve/Reject review actions, no product administration, and no inactive-product Generate or Studio control.
- Both temporary users were signed out and deleted. Follow-up SQL confirms zero matching Auth users, profiles, and provisioning records.
- A direct live `409` request was not issued because no inactive product currently has an active template; creating that condition would mutate shared Production data. Focused lifecycle tests and route review cover the guard until an isolated fixture is available.

Authentication hardening Preview verification completed on 2026-07-13:

- Commit: `47d5056069029fc180c4551e8c70d03a386cae9c`
- Deployment: `dpl_9aob3SNXBpGHobUvvuGntn9Y9bAf`
- Branch alias: `contentgate-git-codex-asset-li-ccfe90-debbies-projects-a8de6bb4.vercel.app`
- State: `READY`
- Unknown magic-link login was rejected with `Signups not allowed for otp`; no Auth user was created.
- A server-provisioned member signed in successfully and loaded the Veltara dashboard with role `member`.
- The member signed out and was deleted; zero Auth users, profiles, and pending provisioning records remain from the test.
- The deployment build completed successfully and no warning/error/fatal runtime logs appeared in the checked window.

Asset Library PR #1 was merged and its Production release gates pass.

## Phase 3 And Phase 4 Production Releases

Verified on 2026-07-13:

- Product workspace PR #2 merged to `main` at `752a3b1`; Production deployment `dpl_PePwAtzv4Ti6rZo1MHeB3aFDDqFM` reached `READY`.
- Authenticated Production checks confirmed all five VitalBite workspace views, product-scoped Knowledge Hub navigation, and no Generate or Studio control for inactive DigestPro.
- Template engine PR #3 merged to `main` at `b517c31`; Production deployment `dpl_EUt85bDDiKwsMoDuwnCmNDwYFFRE` reached `READY`.
- Authenticated Production Studio checks confirmed VitalBite exposes only Square, draft Download PNG remains disabled, and approved Download PNG is enabled.
- No browser console warnings/errors or Vercel error/fatal runtime logs appeared during either Production verification window.

## Phase 5 Knowledge Reliability Preview

Verified on 2026-07-13:

- Preview deployment `dpl_3fS3K4QmXS2EH2y8cnffMuoyW46a` reached `READY` from commit `e84e3ab`.
- A supported VitalBite question returned the approved 70.3% tartar result with an inspectable citation to the exact Dental Efficacy Study paragraph 2.
- An unrelated moon question returned the explicit no-evidence response with no citation.
- Both exchanges persisted after a full page reload; the disposable notebook session was then deleted.
- The two question events remain in `knowledge_queries` as the audit trail. No browser console warnings/errors or Vercel error/fatal runtime logs appeared during the verification window.

Phase 5 was promoted to Production on 2026-07-13:

- PR #5 merged to `main` at `f6a7cd6`; deployment `dpl_EPJ1rxCoPJ43BZHP9C8tSGVXdrmu` reached `READY` on `contentgate-delta.vercel.app`.
- Production repeated the supported 70.3% VitalBite citation, unrelated-question no-evidence response, and full session reload checks successfully.
- The disposable Production notebook session was deleted. No browser console warnings/errors or Vercel error/fatal runtime logs appeared during the Production verification window.

## Phase 6 Approval History Preview

Verified on 2026-07-13:

- Branch `codex/phase6-approval-history` at commit `ac421a2` deployed as Preview `dpl_3aVZx2Z6avBvwFwQex7WPyQfck32` and reached `READY`.
- Live additive migrations `20260713113241_complete_approval_history` and `20260713113807_backfill_missing_content_creation_events` applied successfully.
- Structural checks found 17 current content rows, 17 immutable baseline/current snapshots, 68 historical/baseline events, zero missing current snapshots, zero duplicate revisions, and zero approved-revision pointer mismatches.
- A rollback-only live transaction exercised create, direct-tamper protection, edit/revision increment, submit, approve, exact-revision export, approval revocation on edit, draft-export rejection, audit mirroring, and immutable-history mutation rejection without leaving test content behind.
- Authenticated Preview approved-content QA showed the exact approved revision, immutable snapshot list, complete actor/timestamp history, and enabled export controls.
- A real `clipboard_text` export from content detail was recorded against approved revision 1 and remained visible after reload. This legitimate QA event remains in the append-only audit trail by design.
- Draft content showed author editing and submit controls but no export section. In-review content showed approver review controls, no save action, and no export section.
- Studio enabled generated-copy and creative download only for the approved exact revision; both controls were disabled for the draft revision.
- Browser logs were empty. Vercel reported no warning/error/fatal runtime logs and no runtime error clusters in the checked window.

- Focused asset, workspace, knowledge, approval, template, rate-limit, document-upload, migration-integrity, and worst-case template-render tests pass. The renderer test passed with its temporary local listener permitted; TypeScript, lint, and the Next.js production build also pass.

Phase 6 was promoted to Production on 2026-07-13:

- PR #7 merged to `main` at `1475623`; Production deployment `dpl_CoZSt5pKjCGoCKMCLNCdU7wVJnaN` reached `READY` on `contentgate-delta.vercel.app`.
- Authenticated Production approved-content QA confirmed the immutable history timeline, revision 1 approval pointer, persisted clipboard export event, and enabled export controls.
- Production draft content retained author edit/submit controls and no export section. In-review content exposed Approve/Reject, no save action, and no export section.
- Production Studio enabled generated-copy and creative download for the exact approved revision and disabled both controls for the draft revision.
- Browser logs were empty. Vercel reported no warning/error/fatal runtime logs and no runtime error clusters in the checked window.

## Phase 7 Launch-Readiness Baseline

Audited on 2026-07-13 before release:

- No GitHub Actions CI or scheduled Production smoke workflow existed.
- `product-assets` was public with no bucket-level file size or MIME restrictions; application uploads already verified image bytes with Sharp.
- `documents` was private but had no bucket-level file size or MIME restrictions; the server-action and documented size limits disagreed.
- AI routes authenticated callers but had no durable per-user request limit.
- Supabase advisors reported anonymous execution of `auth_org_id`/`auth_role`, signed-in execution of intentional workflow RPCs, leaked-password protection disabled, missing foreign-key indexes, and high-frequency RLS initialization-plan warnings.
- The live project is `ACTIVE_HEALTHY` on Postgres 17 in `ap-northeast-1`. Supabase plan/backup retention and leaked-password protection require Dashboard confirmation before external customer launch.
- Phase 7 migrations `20260713121504_launch_readiness_security`, `20260713121624_finalize_rate_limit_hardening`, `20260713121734_prepare_private_asset_reads`, and `20260713122123_split_product_configuration_policies` were applied successfully after rollback-only rehearsal. Verification covered function compilation, an authenticated rate-limit call, Storage settings, grants, organization-scoped asset reads, policy creation, and index creation.
- The final advisor pass cleared missing foreign-key indexes, repeated RLS initialization work, the private rate-limit table findings, and overlapping product configuration policies. Remaining `SECURITY DEFINER` notices are limited to the five intentionally authenticated identity/workflow RPCs; leaked-password protection still requires Dashboard enablement.
- `product-assets` remains public only until the compatible signed-URL application build is live in Production; `make_product_assets_private` is the final ordered release migration.
- GitHub `main` protection now strictly requires the `verify` GitHub Actions job and `Vercel` deployment check, applies to administrators, requires linear history and resolved conversations, and blocks force pushes and deletion.
- Preview deployment `dpl_H8inug8gVhtgtbDFPajmw9scQ1pm` reached `READY`. `/api/health` returned `200 {"status":"ok"}` with `no-store`, authenticated dashboard and VitalBite workspace data loaded, and browser/Vercel warning/error/fatal logs were empty.
- Authenticated admin QA uploaded a 1.6 MB PNG through the hardened Asset Library flow. The rendered `1080 x 1080` image used a one-hour Supabase `/storage/v1/object/sign/product-assets/` URL. Cleanup removed both the metadata row and Storage object; independent live counts returned zero.
