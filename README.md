# ContentGate

Approved knowledge in, compliant content out. Generate localized marketing
content from approved documents, gated by a human approval step, with an audit
trail. Sprint plan: `../PLAN.md`.

## Stack

Next.js (App Router) · Supabase (Auth/Postgres/Storage) · Tailwind v4 ·
Claude API · Vercel.

## One-time setup (manual steps)

### 1. Supabase

1. [supabase.com](https://supabase.com) → New project (name: `contentgate`).
2. SQL Editor → paste & run `supabase/migrations/20260612000001_init.sql`.
3. Apply the remaining migrations in timestamp order.
4. SQL Editor → run `supabase/seed.sql` only for a disposable demo project.
5. Authentication → Sign In / Up: enable **Email** provider.
6. Before creating an Auth user, call the server-only `provision_user` RPC with
   their email, organization, role, and name. Then create the user through the
   Supabase Admin API. Public sign-up is rejected by the profile trigger;
   browser login only signs in existing users.

### 2. Environment variables

Copy `.env.example` → `.env.local` and fill in:

| Var | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page |
| `SUPABASE_SERVICE_ROLE_KEY` | same page (keep server-only) |
| `ANTHROPIC_API_KEY` | platform.claude.com → API Keys (needed Day 3+) |

Then add the same four in Vercel → Project → Settings → Environment Variables
and redeploy.

Until the env vars are set, the app runs in **preview fallback mode**: pages
render with placeholder data and sign-in is disabled — useful for UI review,
not connected to anything.

### 3. Local dev

```sh
npm install
npm run dev
```

Before opening a pull request, run:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Production operations and rollback steps live in `LAUNCH_RUNBOOK.md`.

## Architecture notes

- Multi-tenant: `org_id` on every table, RLS everywhere
  (migration is the source of truth).
- Editing approved content auto-reverts it to draft (database trigger).
- Submit/approve/reject/export run through authenticated, transaction-safe RPCs
  that validate organization, role, workflow state, and exact revision.
- Product assets are served through short-lived signed URLs from a private
  bucket; documents are private and downloaded through signed URLs.
- Expensive AI routes use durable per-user database rate limits.
- Verticals are data, not code: industry lives on `organizations.industry`,
  templates and documents are per-org rows.
