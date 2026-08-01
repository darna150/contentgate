# ContentGate enterprise-beta retention, export, and deletion

Status date: July 31, 2026

Policy owner: **must be named and approve these defaults before beta**

Execution owner: Release engineering

These are technically enforced beta defaults and a guarded operator procedure.
They are not legal advice and must be reconciled with the design-partner
contract, legal hold obligations, and processor terms before production use.

## Proposed beta defaults

| Data class | Technical default | Deletion behavior |
|---|---|---|
| Active workspace content and configuration | Retained while the beta workspace is active | Included in customer export and guarded workspace deletion |
| Archived product assets | Recoverable for 30 days | Existing purge worker removes object bytes after `purge_after` |
| Ask operational records | 90 days by default; configurable from 30–3650 days | Guarded purge removes expired query/feedback operational rows |
| Onboarding package upload | Two hours maximum in the control plane; removed immediately on normal success/failure/discard paths | Opportunistic expiry cleanup; not reliably workspace-attributable before provisioning |
| Onboarding/Auth capability token | 30 minutes | Expiry prevents reuse; private/service-only record is removed with its workspace/run |
| Workspace audit history | Retained with the active workspace | Included in export and removed during approved workspace deletion |
| Export/deletion receipts | Retained outside the deleted tenant | Retention duration requires policy/legal approval; receipts contain metadata and hashes, not customer content |
| Infrastructure logs and backups | Controlled by the approved Vercel/Supabase configuration | Customer-visible deletion completes in live systems; residual backup copies age out under processor retention and are not individually rewritten |

Do not promise that a workspace deletion instantly erases immutable backups.
The customer-facing statement must name the verified processor backup retention
once it is approved.

## Workspace export

The export utility reads every table in the machine-checked tenant inventory,
the organization and onboarding-run records, limited Auth identity metadata,
and every object under the workspace UUID in supported tenant Storage buckets.
It produces a mode-0600 ZIP, `manifest.json`, per-entry SHA-256 hashes, an
archive SHA-256 sidecar, and a service-only export receipt.

The beta exporter is bounded to 10,000 entries and 250 MiB of uncompressed
input. It fails closed above either limit. It is a sequential snapshot, not a
transactionally frozen database snapshot; perform exports in a declared
maintenance window and record that limitation for a workspace with active
writes.

Staging example:

```bash
CONTENTGATE_ENVIRONMENT=staging \
CONTENTGATE_SUPABASE_PROJECT_REF=bncwjibscptgijgmuhrn \
npm run workspace:export-data -- \
  --workspace-key qa-lifecycle-example \
  --output /secure/path/qa-lifecycle-example.zip \
  --requester release-owner@example.com \
  --reason "Enterprise beta deletion drill" \
  --confirmation "EXPORT STAGING qa-lifecycle-example"
```

The Supabase URL and service-role key must come from the protected environment;
never place them in the command line or commit them. Production export also
requires `CONTENTGATE_ALLOW_PRODUCTION_DATA_EXPORT=true` and the exact
`EXPORT PRODUCTION <workspace-key>` confirmation.

## Legal holds

`organizations.legal_hold` is fail-closed in both deletion approval and
database preparation. A hold requires a non-empty reference. Release requires
an explicit service-role operation and clears the reference/time only when the
hold is lifted. The legal/compliance owner—not the engineering operator—decides
whether a hold may be released.

No workspace deletion may proceed while a hold is active. An export remains
permitted so evidence can be preserved.

## Guarded workspace deletion

Deletion requires all of the following:

1. A completed matching export receipt and the exact archive SHA-256.
2. A written reason.
3. Different named requester and approver.
4. Exact environment/workspace confirmation.
5. No legal hold.
6. For production only: explicit enablement and a change/ticket identifier.

The service-only database transaction first creates a global receipt and then
removes all tenant rows except profiles. The operator removes Storage through
the Storage API, bans then deletes Auth users through the Auth Admin API, and
finalizes by removing the organization. The final receipt survives tenant
deletion and records table counts, Auth user count, Storage object count,
requester, approver, reason, export hash, and timestamps. A partial failure is
recorded as `failed` for incident handling rather than reported as success.

Staging example:

```bash
CONTENTGATE_ENVIRONMENT=staging \
CONTENTGATE_SUPABASE_PROJECT_REF=bncwjibscptgijgmuhrn \
npm run workspace:delete-data -- \
  --workspace-key qa-lifecycle-example \
  --export /secure/path/qa-lifecycle-example.zip \
  --requester requester@example.com \
  --approver approver@example.com \
  --reason "Approved enterprise beta deletion drill" \
  --confirmation "DELETE STAGING qa-lifecycle-example"
```

Production deletion is disabled unless
`CONTENTGATE_ALLOW_PRODUCTION_DELETION=true`, an explicit `--change-id` is
provided, and the confirmation is exactly
`DELETE PRODUCTION <workspace-key>`. Production execution still requires the
release owner's separate authorization; the existence of the utility is not
authorization.

## Verification and evidence

Before production enablement, a disposable staging workspace must prove:

- export receipt hash equals the created archive;
- every manifest entry hash verifies;
- legal hold blocks deletion before any database mutation;
- same-person request/approval is rejected;
- every tenant table, Storage prefix, profile, Auth sign-in, organization, and
  linked onboarding run is gone after finalization;
- global export/deletion receipts remain queryable by service role and are
  inaccessible to anon/authenticated roles;
- Supabase security advisors report no new errors.

Record exact source SHA, migration version, staging project, disposable
workspace key, timestamps, requester/approver test identities, row/object/user
counts, archive hash, receipt IDs, and evidence owner. Never commit the archive.

## Failure handling

Stop on the first error and preserve the archive and receipt ID. Do not manually
delete remaining rows or report completion. Treat a failure after database
preparation as an incident: restrict the workspace, inventory remaining Storage
and Auth state, reconcile against the export, and use a reviewed recovery
procedure. A retry/resume operator command is intentionally not claimed in this
beta version and is a required follow-up before routine production deletion.
