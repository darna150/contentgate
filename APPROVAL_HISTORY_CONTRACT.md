# ContentGate Approval History Contract

Last updated: 2026-07-13

## Purpose

Phase 6 makes generated-content governance inspectable and revision-specific.
The system must be able to answer who created, generated, edited, submitted,
approved, rejected, or exported a piece of content, and which immutable revision
the action affected.

## Canonical Records

`generated_content` remains the current working record. It now carries:

- `current_revision_number`: the latest immutable content snapshot.
- `approved_revision_number`: the exact revision approved for export, or null.

`generated_content_revisions` is append-only and stores the complete governed
payload for each revision, including body, structured fields, citations, source
documents, prompt context, product/template identity, actor, and capture status.

`generated_content_events` is the append-only workflow timeline. It records:

- `content.created`
- `content.generated`
- `content.edited`
- `content.submitted`
- `content.approved`
- `content.rejected`
- `content.approval_revoked`
- `content.exported`

Every event contains the actor snapshot, revision number, timestamp, and
event-specific detail. Canonical events are mirrored to `audit_log` for the
organization-level administrative audit surface.

## Revision Rules

- Initial generated content starts at revision 1.
- Regeneration and manual edits create a new immutable revision.
- Workflow-only transitions do not create a new revision; they point to the
  current revision.
- Editing approved content increments the revision, moves the record to draft,
  clears approval metadata, and records `content.approval_revoked`.
- Existing records at migration time receive an honest baseline snapshot. Older
  event timestamps are retained, but historical bodies that predate Phase 6 are
  not reconstructed.
- Legacy records missing create/generate audit rows receive idempotent baseline
  events using their original author and creation timestamp.

## Workflow Rules

The authenticated `transition_generated_content` RPC owns state promotion:

- Author or admin: `draft`/`rejected` to `in_review`.
- Approver or admin: `in_review` to `approved` or `rejected`.
- Rejection requires a reviewer note.

Direct authenticated table updates may edit author-owned content, but the
database trigger pins workflow fields so clients cannot promote or rewrite
status directly.

## Export Rules

The authenticated `record_generated_content_export` RPC records exports only
when:

- The caller belongs to the content organization.
- Status is `approved`.
- `approved_revision_number` equals `current_revision_number`.
- Format is one of Markdown, clipboard text, PNG, JPEG, or PDF.

Markdown, content-detail clipboard copy, Studio clipboard copy, and Studio
downloads all pass through this boundary. Each event stores actor, format,
revision, timestamp, surface, and output size when applicable.

## Access And Immutability

- All exposed history tables have RLS enabled.
- Authenticated users can select history only for their organization.
- Authenticated and anonymous clients cannot insert, update, or delete history.
- Update/delete triggers reject history mutation even through privileged table
  access.
- Trigger helpers are not executable by application roles.
- Workflow RPCs are `SECURITY DEFINER` only because they perform atomic governed
  writes. They require `auth.uid()`, verify organization/role, use fully
  qualified objects, set an empty search path, and grant execution only to the
  authenticated role.

## UI Boundary

- Only the author sees editable controls in editable lifecycle states.
- Approvers and admins see approve/reject controls only while content is in
  review.
- Generated copy and creative downloads remain disabled until the exact current
  revision is approved.
- Content detail shows the event timeline and immutable revision summaries.

Comparison views, richer reviewer-note presentation, and queue filtering can be
calibrated later without changing this database contract.
