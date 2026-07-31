# ContentGate enterprise-beta reliability and incident readiness

Status date: July 31, 2026

Engineering owner: Release engineering

Named incident owner, client-contact owner, and go/no-go approver: **required
before beta; not yet assigned**

## Current recovery posture

Both Supabase projects are healthy Pro-plan projects in `ap-northeast-1`:

- staging: `bncwjibscptgijgmuhrn`;
- production: `egjssfcenboalijfdmsi`.

Supabase's current backup documentation states that Pro projects receive daily
database backups with seven-day retention. Daily database backups do not
contain Storage object bytes, and restoring makes the project unavailable for
a duration that depends on database size. PITR is a separately billed add-on;
when enabled, its documented worst-case database RPO is two minutes.

References:

- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase PITR usage and pricing](https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery)

The repository and project-plan evidence therefore support only a **24-hour
database RPO assumption**, not a proven RPO. No Storage-byte recovery claim is
currently supportable. A restore has not been timed, so no RTO has passed.

## Beta recovery target requiring approval

The recommended enterprise-beta objective is:

- database RPO: 2 minutes, requiring the 7-day Supabase PITR add-on;
- Storage RPO: 24 hours initially, requiring an encrypted independent object
  snapshot or processor-supported equivalent;
- application RTO: 1 hour by Vercel deployment rollback;
- complete service RTO: 4 hours, to be accepted only after a timed database and
  Storage recovery drill.

PITR has a recurring cost and Storage protection requires a selected backup
destination. Engineering must not enable or purchase either without owner
approval. If the first design partner accepts daily database recovery and an
explicit Storage limitation, record that time-bounded exception; do not market
the recommended target as achieved.

## Restore drill

Use a disposable recovery target—never overwrite production and do not use
customer data in a development branch.

1. Record the source backup timestamp, migration head, object counts, database
   checksum/sample IDs, and expected Auth/Storage limitations.
2. Restore or clone into the approved isolated target.
3. Start the clock before the restore request and record platform availability
   transitions.
4. Verify schema/migration head, tenant isolation, representative Auth, product,
   document, content-governance, audit, and Storage paths.
5. Reconcile every expected missing item, especially Storage bytes and custom
   database-role passwords excluded from provider backups.
6. Run smoke, deterministic E2E, and the permanent two-tenant isolation test.
7. Record measured RPO/RTO and delete the temporary target only after the
   evidence owner signs the drill.

This drill is open. Creating an isolated Supabase branch/project may incur a
cost and requires explicit approval; restoring staging in place is not an
acceptable substitute while it supports release certification.

## Availability and alert routing

`/api/health` checks the database API, rendered/template Storage buckets,
worker liveness, and overdue asset processing. The protected Vercel cron calls
it daily as a backstop. `CRON_SECRET` is mandatory; missing configuration fails
with 503 instead of silently exposing or skipping the monitor.

When health fails, the route emits a structured error and sends a bounded
five-second HTTPS webhook containing severity, service, timestamp, environment,
deployment SHA, health detail, and the configured incident owner. The webhook
requires a bearer token. Delivery failure is itself a structured error and does
not convert the failed health result to success.

Production is not monitor-ready until all four variables are present and a
synthetic failure reaches the named owner:

- `CRON_SECRET`;
- `CONTENTGATE_INCIDENT_WEBHOOK_URL`;
- `CONTENTGATE_INCIDENT_WEBHOOK_TOKEN`;
- `CONTENTGATE_INCIDENT_OWNER`.

The current Vercel plan rejected a five-minute cron schedule and permits only a
daily run. Enterprise beta therefore still requires either a Vercel plan upgrade
or an external monitor polling `/api/health` at five-minute intervals with its
own routed alert. Preview deployments validate the route, but Vercel cron
executes only on production.

## Provider-dependency failure evidence

Ask and content generation use bounded provider attempts. Exhaustion returns a
safe `502` or `503` response with `Retry-After`, records structured operational
evidence, and attempts the same bounded authenticated incident route. Responses
do not expose provider errors, prompts, source material, credentials, or user
identifiers. The validation-only failure injector is fail-closed to all of the
following at once:

- the known staging Supabase project;
- a Vercel Preview or local development/test runtime;
- the exact `provider-failure` validation header; and
- an ephemeral email identity matching the synthetic QA namespace.

It cannot activate in production, for a normal user, or from the header alone.

On 2026-07-31, application SHA
`76d5fa58197c384fd78ec117f02b152530672e43` passed the guarded Preview gate:

- Ask made two attempts, returned safe `502` plus retry guidance, wrote one
  synthetic `provider_error` query with no citations, and created no content;
- generation made four attempts and returned safe `503` plus retry guidance;
- both routes attempted incident delivery and recorded
  `provider.incident_unconfigured` against the exact deployment SHA; and
- the subsequent happy-path capacity regression passed, proving the failure
  controls did not break normal Ask or generation.

`provider.incident_unconfigured` is intentionally a failing operational result,
not proof of alert delivery. Engineering has therefore proven safe degradation
and visible routing failure; a real destination, token, named owner, and human
acknowledgement remain required before beta access.

## Severity and response

| Severity | Trigger | Acknowledge target | First action |
|---|---|---|---|
| P0 | Cross-tenant access, credential exposure, approval bypass, or unrecoverable data loss | 15 minutes | Disable affected capability, preserve evidence, stop rollout, engage engineering owner and client contact |
| P1 | Sign-in, generation, review, export, onboarding, or health dependency unavailable without a safe workaround | 30 minutes | Halt rollout, inspect exact-deployment logs, choose rollback or provider recovery |
| P2 | Degradation with a safe workaround and no control failure | 1 business day | Record evidence, assign owner, protect P0/P1 work |

Targets are operational goals for the controlled beta, not contractual SLAs.
Support hours and escalation contacts must be recorded in the partner acceptance
before access is granted.

## Tabletop script

The first tabletop must involve the named engineering owner, client-contact
owner, and go/no-go approver:

1. Inject a synthetic health failure in staging and prove one routed P1 alert.
2. Acknowledge it from the configured incident channel and record elapsed time.
3. Classify whether the failure is application-only or stateful.
4. Select the exact previous healthy Vercel deployment for application rollback.
5. For stateful loss, identify the approved recovery point without executing a
   production restore.
6. Draft client communication containing impact, start time, known scope,
   workaround, next update, and owner.
7. Preserve logs, deployment SHA, database timestamps, and decisions.
8. Record gaps, corrective owners, and due dates.

This tabletop remains open until real named owners and a real alert destination
participate. Unit tests prove the routing code's authentication, HTTPS, timeout,
and failure behavior; they do not prove human response.
