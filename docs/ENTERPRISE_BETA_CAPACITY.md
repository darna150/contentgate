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
`tests/e2e/enterprise-capacity.spec.ts`. The stateful rows must use synthetic or
explicitly approved staging fixtures, preserve immutable audit evidence, and
clean up disposable data. They remain required before the capacity control can
be marked pass.

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
The stateful capacity rows remain open.
