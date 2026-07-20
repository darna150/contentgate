# ContentGate MVP Security Review

Last updated: 2026-07-13

## Identity And Authorization

- Public signup is disabled. Membership is created through the server-only provisioning handshake.
- Organization and role live in protected profile columns and cannot be changed by browser clients.
- RLS scopes governed records and Storage paths to the signed-in user's organization.
- Admin, approver, and author capabilities are enforced in the database or trusted transactional RPCs, not only in UI controls.

## Storage And Uploads

- `documents` is private and uses short-lived signed downloads.
- `product-assets` is private and uses one-hour signed URLs for organization-scoped reads.
- Product images are limited to 10 MB and approved image MIME types in application code and Storage. Sharp verifies that file bytes match the declared image type.
- Documents are limited to 10 MB and an explicit parser-supported extension/MIME allowlist in application code and Storage.
- Database backups do not contain Storage object bytes. A separate asset export/replication process is required before external customer launch if deleted-file recovery is required.

## Privileged Functions

- `auth_org_id` and `auth_role` remain `SECURITY DEFINER` because they avoid recursive profile RLS. They use an empty search path, return only the caller's membership, deny anonymous execution, and are callable by authenticated users for RLS evaluation.
- `transition_generated_content`, `record_generated_content_export`, and `consume_api_rate_limit` intentionally remain authenticated `SECURITY DEFINER` endpoints. Each derives identity from `auth.uid()`, accepts a fixed input surface, validates organization/role/state, uses an empty search path, and grants no anonymous execution.
- New public functions receive no implicit `PUBLIC`, `anon`, or `authenticated` execution grant; each RPC must opt in explicitly.

## Abuse And Cost Controls

- Knowledge Hub: 10 requests per user per minute.
- Structured content generation: 5 requests per user per 5 minutes.
- Legacy generation route: 3 requests per user per 5 minutes.
- Counters are atomic and durable in a private table. The server fails closed if the rate-limit service is unavailable.
- Request payloads, template fields, source selection, and upload sizes have explicit limits.

## Secrets And Dependencies

- Browser code receives only the Supabase URL and publishable/anon key.
- Supabase service-role and OpenAI keys are server-only and must exist only in encrypted local/Vercel environment storage.
- `.env.example` contains placeholders only; `.env*` remains ignored.
- CI fails on high/critical production dependency advisories and runs the lockfile with `npm ci`.

## Monitoring And Recovery

- `/api/health` returns only `ok` or `unavailable` and checks Supabase connectivity.
- GitHub Actions runs an hourly Production smoke check; Vercel runtime errors remain the primary serverless error signal.
- Supabase paid projects receive daily database backups; PITR is optional. Confirm the project's plan, retention window, and a restore owner before external launch.

## Remaining Manual Launch Gates

- Enable and verify Supabase leaked-password protection in Auth settings.
- Confirm daily backup retention or create a scheduled off-site logical backup if the project remains on the free plan.
- Decide whether Storage object replication/export is required for the pilot's recovery objective.
- Complete Claude Code responsive/state QA and later Figma template calibration without changing backend security contracts.
