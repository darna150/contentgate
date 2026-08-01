# ContentGate enterprise-beta data inventory

Status date: July 31, 2026

Technical owner: Release engineering

Approval owner: **must be named before first enterprise-beta contract**

This inventory describes the exact repository-backed beta system. It is a
technical record, not a representation that a privacy review, DPA, transfer
assessment, or certification has been completed. The machine-readable source
is `config/workspace-data-lifecycle.json`; clean-migration tenant-isolation CI
fails if an org-scoped table is added without updating that source.

## Data flow and systems

| System | Purpose | Customer data handled | Technical location | Contract record required before beta |
|---|---|---|---|---|
| Vercel | Web application, server routes, deployment logs, analytics, and performance telemetry | Request metadata; user and workspace data processed transiently by server routes; operational logs | Project `prj_grjyPK0Jc6Ng7ojBzHRXSOxGaxDL`; deployment region/configuration must be exported and approved | DPA/subprocessor entry, selected function regions, log retention, support-access owner |
| Supabase | Postgres database, Auth, private Storage, API | All persisted workspace records, member identities, source documents, assets, templates, renders, and audit history | Staging `bncwjibscptgijgmuhrn` and production `egjssfcenboalijfdmsi` are healthy in `ap-northeast-1` | DPA/subprocessor entry, approved backup/PITR and Storage recovery, support-access owner |
| OpenAI API | Ask, generation, knowledge import, and embeddings | Prompt instructions, selected source/claim context, generated text, and embedding inputs | Server-to-server calls from Vercel; configured models are environment variables | DPA/subprocessor entry, approved API data controls, region/transfer position, model allowlist |
| GitHub | Source control and CI | Source and synthetic test evidence; customer secrets and customer exports are prohibited | Private repository and Actions | Access owner, log/artifact retention, branch protection evidence |

No customer export archive may be uploaded to GitHub, attached to a pull
request, or retained on an unmanaged workstation. Export archives contain
customer content and limited member identity metadata.

## Persisted tenant data

The complete table-level inventory is in
`config/workspace-data-lifecycle.json`. Its 29 `orgScopedTables` cover:

- workspace identity and membership (`organizations`, `profiles`);
- products, campaigns, claims, brand voice, documents, and knowledge-derived
  records;
- generated content, revisions, governance events, renders, and audit history;
- product assets and derivatives, template bundles, versions, variants, and
  assignments;
- bounded operational records for Ask, asset processing, template imports, and
  beta UX measurements.

The service-role-only onboarding control plane stores package blueprints,
operator email/user identifiers, provisioning steps, and diagnostic reports.
Package-upload records are operator-scoped and expire after two hours; the
current schema cannot reliably attribute one upload row to a resulting
workspace. That limitation is explicit in exports and must be corrected before
claiming workspace-level completeness for pre-provisioning uploads.

## Storage and Auth

Private Storage buckets are `documents`, `onboarding-packages`,
`product-assets`, `rendered-assets`, and `template-bundles`. Persisted workspace
objects use the organization UUID as the first path segment. The lifecycle
export enumerates the supported tenant-prefix buckets through a service-only
RPC and downloads bytes through the Storage API. It does not delete Storage
rows directly with SQL.

Customer exports contain limited Auth identity metadata: user ID, email,
creation time, last sign-in time, ban state, and MFA factor type/status. They
exclude password hashes, factor secrets, tokens, and sessions. Auth users are
disabled and deleted through the Supabase Auth Admin API during approved
workspace deletion.

## Derived and operational data

Knowledge chunks and embeddings are derived from customer documents and remain
customer data. Ask query/feedback records, render jobs, processing jobs, import
runs, and UX events are operational data but remain tenant-scoped and are
included in workspace export/deletion. Logs held by infrastructure processors
are outside the database export and follow the separately approved processor
retention.

## Open procurement inputs

Before a design partner is onboarded, the assurance owner must record exact
processor legal entities, DPAs, remaining configured regions, international-transfer
position, infrastructure log retention, backup/PITR retention, support access,
and deletion propagation. Unknown values must be disclosed as beta limitations,
not inferred from the codebase.
