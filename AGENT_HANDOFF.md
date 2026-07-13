# Agent Handoff

Last updated: 2026-07-13

## Current Direction

Use `PRODUCT_DIRECTION.md` as the product source of truth. The older `HANDOVER.md` reflects an earlier regulated animal-health SaaS framing and should not be treated as the current strategy without cross-checking the newer docs.

Use `MVP_ROADMAP.md` as the current execution order. It records completed work, release gates, Codex/Claude Code ownership, and exit criteria for each phase.

Current direction:

- Brand/content management platform.
- Sesimi/Brandfolder/Frontify/Canva-for-Teams inspired.
- MVP wedge: approved source knowledge + locked templates + brand-safe content production + approval-only export.
- Apex Canine is the template implementation standard.

## Codex Lane

Codex should handle:

- Product architecture docs.
- Production/deployment audit.
- Supabase migrations and RLS.
- API route hardening.
- Approval/export workflow integrity.
- Build/lint/test verification.

## Claude Code Lane

Claude Code should handle:

- Figma-to-UI implementation.
- Visual design polish.
- Studio UX.
- Template spacing and visual calibration.
- Mobile visual QA.

Claude Code should not loosen backend security, approval, RLS, or export constraints.

## Work Completed In This Pass

- Added product direction, MVP roadmap, architecture, template onboarding, production audit, and handoff docs.
- Inspected live Vercel project and recent deployment state.
- Identified runtime error groups related to Supabase DNS fetch failures in middleware.
- Added an additive Supabase migration to harden profile roles/orgs, source document writes, product asset storage writes, generated content draft insertion, and generated content update policies.
- Moved submit-for-review to the trusted service-role path after org/author/state/template validation.
- Blocked direct generated creative rendering unless content is approved.
- Added conservative validation/filtering for generated evidence before citations are stored.
- Added required Supabase and Anthropic environment variables to Vercel Preview.
- Deployed the hardened local worktree to Vercel Preview:
  - Deployment: `dpl_szJ3Y36gxDuYfG5Lwnuc7M1D3CWt`
  - URL: `https://contentgate-qk5bhjj3i-debbies-projects-a8de6bb4.vercel.app`
- Confirmed preview login/auth middleware behavior and unauthenticated render protection.
- Confirmed no error/fatal runtime logs for the latest preview deployment in the checked 24-hour window.
- Confirmed no error/fatal runtime logs for the latest preview deployment in the checked 2-hour window after the live Supabase project was restored and the migration applied.
- Cleared the current lint backlog:
  - Targeted CommonJS lint disables for visual utility scripts.
  - Typed `scripts/render-check.tsx` ImageResponse rendering.
  - Replaced `/products` HTML anchors with `next/link`.
  - Removed an unused studio flag.
  - Converted shared creative-layout nested JSX components into render helpers.
- Verified `git diff --check`, `npm run lint`, and `npm run build` pass locally on 2026-07-08 after migration confirmation.
- Completed an authenticated draft -> review -> reject -> resubmit -> approve workflow check on Vercel Preview.
- Fixed approved content deep links so Studio derives the canonical product/template from the saved content record instead of falling back to the first active product.
- Verified the corrected preview loads approved VitalBite content in Generated mode with approved export controls and no browser or Vercel runtime errors.
- Completed the Codex Asset Library backend foundation and documented it in `ASSET_LIBRARY_CONTRACT.md`.
- Applied and verified four additive live Supabase migrations: metadata/indexes, explicit asset RLS, storage-listing hardening, and scoped admin object visibility for Storage deletes.
- Added verified image metadata extraction, admin upload/edit/delete actions, audit events, reusable filtering/preview data, and focused contract tests.
- Deployed commit `e20da6f` to Production as `dpl_4qzkufrnNnGbLnSEhdHNSkLNGzB9`.
- Completed an authenticated production Asset Library smoke test in Chrome.
- The first delete test exposed a Storage API requirement for scoped object visibility; added and applied `allow_admin_asset_storage_read`, cleaned the orphaned test object through the Storage API, and reran delete successfully.
- Confirmed all temporary test rows and objects were removed and create/update/delete audit events were recorded.
- Reviewed Claude Code's dedicated `/assets` implementation against `ASSET_LIBRARY_CONTRACT.md`; no backend contract or security-boundary changes were introduced.
- Verified the UI includes URL-backed search and product/type/status/tag filters, grid/list views, previews, metadata editing, upload feedback, delete confirmation, and admin/member control separation.
- Fixed a reproduced filter race where the delayed title search could erase a newly selected filter.
- Replaced the fixed-width phone sidebar with a shared mobile header and navigation drawer; verified 375px and 1440px layouts have no horizontal overflow.
- Added keyboard focus containment to shared asset dialogs, limited upload choices to active products, and aligned all-status UI copy with the governed asset contract.
- Re-ran `git diff --check`, lint, focused asset tests, production build, and local browser console/layout verification successfully.
- Committed the reviewed Asset Library UI as `52d6abb`, pushed `codex/asset-library-ui`, and opened draft PR #1.
- Verified Vercel Preview `dpl_3A9W8nPQENe7YmFpTZPhNWDXx24y` at `https://contentgate-qxc4qobn5-debbies-projects-a8de6bb4.vercel.app`.
- Completed the authenticated Preview admin workflow: upload, image preview, metadata/alt-text/tag edit, URL-backed combined filtering, list view, and permanent delete.
- Confirmed the disposable QA row and Storage object were removed and the Preview emitted no warning/error/fatal runtime logs in the checked window.

## Remaining Blocker

Resolved on 2026-07-08: Claude Code restored the paused live Supabase project `egjssfcenboalijfdmsi` to `ACTIVE_HEALTHY` and applied the hardening migration successfully:

- `supabase/migrations/20260706000001_harden_approval_security.sql`

Claude Code verified:

- `apply_migration` returned success with no SQL errors.
- `protect_profile_membership_fields` trigger exists on `profiles`.
- `authenticated` can update only `profiles.full_name`.
- New admin-gated document and storage policies exist.
- New generated-content draft-only insert/update policies exist.
- Superseded policies were dropped.
- Remaining Supabase security advisor warnings are pre-existing and unrelated to this migration.

## Next Agent Should Check

- Sign in to the Asset Library Preview with a non-admin member account and confirm upload/edit/delete controls are absent while preview, search, and filters remain usable.
- Promote the reviewed Asset Library release only after that member check passes, then record the Production deployment and smoke-test result.
- After the Asset Library release, begin Phase 3 by defining the shared product/workspace query and permission contract before Claude Code restructures the product detail UI.
- Consider a future server-side creative export endpoint for live-canvas templates. The official UI blocks draft export, but any browser-rendered canvas can still be screenshotted by a determined user.

## Do Not Break

- Existing live deployment on Vercel.
- Apex Canine locked-template behavior.
- CaniGuard 5 and VitalBite square live canvas behavior.
- Knowledge Hub notebook sessions.
- Approval-only export promise.
