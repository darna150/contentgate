# Agent Handoff

Last updated: 2026-07-12

## Current Direction

Use `PRODUCT_DIRECTION.md` as the product source of truth. The older `HANDOVER.md` reflects an earlier regulated animal-health SaaS framing and should not be treated as the current strategy without cross-checking the newer docs.

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

- Manually confirm the Markdown and live-canvas PNG files arrive in the local downloads folder. Browser automation could click the controls but did not expose the resulting download event.
- Confirm `/api/creative/render` returns a rendered asset for approved content. Draft export absence was verified in the UI, but direct image-route navigation was blocked by the browser client before the application response could be observed.
- Consider a future server-side creative export endpoint for live-canvas templates. The official UI blocks draft export, but any browser-rendered canvas can still be screenshotted by a determined user.

## Do Not Break

- Existing live deployment on Vercel.
- Apex Canine locked-template behavior.
- CaniGuard 5 and VitalBite square live canvas behavior.
- Knowledge Hub notebook sessions.
- Approval-only export promise.
