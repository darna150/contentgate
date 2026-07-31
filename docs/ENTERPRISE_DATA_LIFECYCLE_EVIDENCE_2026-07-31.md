# Enterprise data lifecycle evidence — July 31, 2026

Evidence owner: Codex release engineering

## Candidate and environment

- Source implementation commit: `d251564` (`codex/enterprise-beta-foundation`)
- Staging project: `bncwjibscptgijgmuhrn`
- Production project: not accessed or mutated
- Applied staging migrations:
  - `20260731140658_workspace_data_lifecycle`
  - `20260731141037_grant_workspace_lifecycle_service_access`
- Evidence completed: `2026-07-31T14:13:39Z`

The migration versions above match the checked-in filenames and the staging
migration ledger. The second migration makes service-role reads explicit for
older tables under Supabase's current Data API grant behavior; the first staging
attempt failed closed on that missing privilege before producing an export and
its disposable fixture was cleaned up.

## Disposable staging journey

The guarded `npm run qa:enterprise-data-lifecycle` journey created one synthetic
workspace, one admin Auth user/profile, one product and audit event, and one
object in each supported tenant-prefix Storage bucket. It then exercised the
same export and deletion commands documented for operators.

| Evidence | Result |
|---|---|
| Workspace key | `qa-lifecycle-4063b7b9` |
| Organization ID | `c8ee14a4-318d-4363-b494-a2db7c96088f` |
| Export receipt | `7c5c8c72-3938-4abb-9795-7d1573638f94` |
| Deletion receipt | `20ddc834-831b-40c7-bd53-1f457946efd9` |
| Export archive SHA-256 | `916bcdd6ae6004de8a7fb859e378aa0ed3e344857bd525c978aef546c297cefc` |
| Manifest/entry integrity | Pass; every archive entry was size/hash verified before deletion |
| Legal hold | Pass; deletion was rejected before a receipt or mutation while hold was active |
| Dual approval | Pass; identical requester/approver was rejected |
| Database lifecycle | Pass; all inventoried tenant rows, linked onboarding rows, profiles, and organization were removed |
| Storage lifecycle | Pass; four objects removed through the Storage API |
| Auth lifecycle | Pass; one user was banned then removed through the Auth Admin API |
| Surviving evidence | Pass; global deletion receipt remained `completed` with matching hash and counts |
| Browser access to receipt | Pass; anonymous Data API client could not read the service-only receipt |

A separate post-run staging query returned `organization_rows = 0`,
`profile_rows = 0`, and `storage_rows = 0`, while the deletion receipt remained
`completed`. The temporary export archive was created in a mode-0600 temporary
directory and removed after the synthetic test.

## Source and build gates

- `npm test`: 350 tests passed, 0 failed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; 35 application pages generated.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.
- Migration integrity: 90 checked-in migrations, no duplicate version/name,
  empty migration, conflict marker, or unscoped `SECURITY DEFINER` function.
- Supabase staging security advisors after DDL: 0 `ERROR`. The two new receipt
  tables produce expected informational `RLS enabled/no policy` notices because
  every browser grant is revoked and only `service_role` is allowed.

The local machine did not have Docker/Podman for clean-migration replay. The
later integrated candidate `795c860` passed the exact remote Vercel deployment,
verify, permanent clean-migration two-tenant isolation, and Preview
accessibility/E2E gates with these lifecycle migrations and contracts present.

## Current limitations and owner decisions

- The export is bounded and sequential, not a transactionally frozen snapshot.
  Use a declared maintenance window for a workspace receiving active writes.
- Pre-provisioning package-upload rows are operator-scoped and cannot always be
  attributed to a resulting workspace; they remain on a two-hour expiry path.
- A failed deletion is durably marked `failed`, but a reviewed resume command is
  not yet implemented. Treat partial failure as an incident.
- Exact Supabase/Vercel regions, processor DPAs, backup/log retention, deletion
  propagation, receipt retention, and the policy owner still require business
  approval before the first enterprise-beta contract.
- No production export, deletion, migration, configuration change, or data
  mutation was performed.
