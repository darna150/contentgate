# ContentGate enterprise-beta capacity envelope

Status date: July 31, 2026

This is a controlled design-partner beta envelope, not a general scale claim or
contractual SLA. Tests are restricted to the staging Supabase project and a
Vercel Preview or local application target. The checked-in gate refuses unknown
or production targets and caps concurrency so an operator cannot accidentally
turn it into an unbounded load test.

## Proposed beta envelope

| Surface | Concurrent demand | Acceptance threshold |
|---|---:|---:|
| Health/readiness | 20 probes | 0 non-200 responses; p95 at or below 5 seconds |
| Authentication | 5 simultaneous sign-ins | 0 failures; p95 at or below 15 seconds |
| Core authenticated reads | 5 active users, each loading Dashboard, Content, Reviews, and Ask | 0 HTTP errors or login bounces; p95 at or below 10 seconds |
| Asset upload | 2 simultaneous supported files, each at or below 10 MiB | 0 cross-tenant paths, incomplete records, or unrecovered failures |
| Grounded Ask | 2 simultaneous questions | 0 5xx; both source-bound or safely not-found; p95 at or below the existing 15-second Ask gate |
| Generation | 2 simultaneous generations | 0 5xx or corrupt drafts; bounded rate-limit/retry behavior |
| Review/export | 3 simultaneous review or approved-export actions | No lost transition, duplicate approval, wrong revision, or invalid export |

The first three rows are implemented by
`tests/e2e/enterprise-capacity.spec.ts`. Upload, Ask, generation, review, and
export are implemented by
`tests/e2e/enterprise-stateful-capacity.spec.ts`. The stateful gate uses three
disposable role-bound users in the approved Nimbus staging fixture, preserves
its evidence as a Playwright attachment, and removes its users, content, files,
queries, jobs, and synthetic audit rows through a tightly bounded service-only
disposer. Both gates are required for the capacity control to pass.

## Running the bounded read gate

Load the staging Supabase URL and service key without printing them. The gate
creates distinct disposable member identities in an isolated workspace, sends
no email, and removes the Auth users and workspace in teardown. Then run:

```sh
CONTENTGATE_E2E_CAPACITY=1 \
CONTENTGATE_E2E_BASE_URL="https://<exact-preview>.vercel.app" \
npx playwright test tests/e2e/enterprise-capacity.spec.ts --workers=1
```

`CONTENTGATE_CAPACITY_USERS` may be set from 1 to 10 and
`CONTENTGATE_CAPACITY_HEALTH_CONCURRENCY` from 1 to 50. Higher values require a
separately reviewed test plan and are intentionally rejected by this gate.

## Running the bounded stateful gate

The stateful gate refuses production, unknown Supabase projects, non-Preview
remote hosts, non-Nimbus fixtures, and concurrency outside its checked-in
2-upload / 2-Ask / 2-generation / 3-export envelope. Run it against the exact
candidate Preview:

```sh
CONTENTGATE_E2E_STATEFUL_CAPACITY=1 \
CONTENTGATE_E2E_BASE_URL="https://<exact-preview>.vercel.app" \
npm run qa:enterprise-stateful-capacity
```

The two upload files are small synthetic PNGs. This exercises the signed TUS
upload and supported worker path without using large-file traffic as a proxy
for concurrency. The gate refuses to start its bounded worker if any unrelated
queued media job exists.

## Evidence required

For every release candidate, retain the JSON attachments from Playwright and
record the exact application SHA, Preview URL, staging project reference,
envelope values, p95 results, status distribution, timestamp, and evidence
owner. A passing read gate does not certify AI-provider capacity, mutation
correctness, production capacity, or an SLA.

## Candidate evidence

- Evidence time: 2026-07-31T15:01Z
- Application SHA: `2b74d931f8ae8f60eb248a6215db5b29c61b4308`
- Preview: `https://contentgate-git-codex-enterpri-9a463e-debbies-projects-a8de6bb4.vercel.app`
- Database: staging `bncwjibscptgijgmuhrn`
- Evidence owner: Codex engineering task

Result: **2 passed in 20.0 seconds**.

| Measurement | Result | Threshold |
|---|---:|---:|
| Health burst | 20/20 returned 200; p95 2,312 ms | 0 errors; p95 at or below 5,000 ms |
| Password authentication | 5/5 distinct disposable members; p95 954 ms | 0 errors; p95 at or below 15,000 ms |
| Authenticated route waves | 20/20 loads; p95 2,388 ms | 0 errors/login bounces; p95 at or below 10,000 ms |

The run found and closed a cold-page hydration race: the server-rendered login
button was initially submittable before React attached the credential handler.
The button now remains disabled until hydration, and a JavaScript-disabled
Playwright contract permanently verifies that behavior. Concurrent Auth uses
five distinct official Supabase SSR clients; their resulting cookies are then
loaded into five isolated browser contexts for the route waves.

Teardown and an independent post-run read found zero matching disposable
organizations, profiles, and Auth users. Production was not used or mutated.

## Stateful candidate evidence

- Evidence time: 2026-07-31T15:41Z
- Application SHA: `4f01b553e62bbf0a88ccb3752e1454c7d32880cc`
- Preview: `https://contentgate-git-codex-enterpri-9a463e-debbies-projects-a8de6bb4.vercel.app`
- Database: staging `bncwjibscptgijgmuhrn`
- Evidence owner: Codex engineering task

Result: **1 passed in 1.8 minutes**.

| Measurement | Result | Threshold |
|---|---:|---:|
| Asset upload and processing | 2/2 approved; both jobs completed on attempt 1; p95 14,517 ms | No corrupt, cross-tenant, or incomplete asset |
| Grounded Ask | 2/2 returned 200 with one verified citation each; p95 12,376 ms | 0 5xx; safe evidence; p95 at or below 15,000 ms |
| Generation | 2/2 returned 200 on attempt 1; p95 7,485 ms; both created complete revisioned drafts | 0 5xx or corrupt draft; bounded retries |
| Review workflow | Both submissions and approvals recorded once at revision 2 | No lost or duplicate transition; exact revision |
| Approved export | 3/3 returned 200; p95 11,690 ms; each was a valid 637,035-byte 1080×1080 PNG | Valid output; exact approved revision; immutable receipt |

This run also found and closed a second cold-page hydration race: the Assets
page exposed its upload button before the client handler was attached. The
button is now server-rendered disabled and becomes interactive only after
hydration. Export certification found that completed render jobs previously
lacked the canonical `content.exported` event; render job creation and export
evidence are now one database transaction.

Teardown returned a bounded disposal receipt and an independent pre-run read
found zero residual synthetic profiles. Production was not used or mutated.
