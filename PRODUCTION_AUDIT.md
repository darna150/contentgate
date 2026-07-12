# Production Audit

Last updated: 2026-07-08

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
