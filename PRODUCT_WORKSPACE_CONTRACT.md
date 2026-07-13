# Product Workspace Contract

Last updated: 2026-07-13

## Purpose

The product workspace is the single read boundary for the complete state of one
product. UI views may present different slices, but they must not rebuild their
own organization, role, product, or status rules.

The server entry point is `getProductWorkspace(productId)` in
`src/lib/product-workspace-server.ts`. Pure permission and empty-state rules live
in `src/lib/product-workspace.ts` so they can be tested without Supabase.

## Returned Data

The service returns:

- Viewer identity, organization, and role.
- Product profile and lifecycle status.
- Governed product assets with public preview URLs.
- Product source documents.
- Product claims, including status.
- All product templates plus the active subset used for generation.
- Product-generated content and status counts.
- The product's in-review approval queue.
- Shared permissions and section empty states.

All database reads use both the viewer's `org_id` and the requested
`product_id`, in addition to Supabase RLS. A product outside the viewer's
organization resolves as not found.

## Source Approval Meaning

The current `documents` table has no approval-status column. Product source
documents are therefore treated as approved sources because document writes are
admin-only and generation already consumes every accessible document attached
to the product. Do not add a UI-only source approval flag. A future source
review workflow requires an additive database migration and generation-policy
change first.

## Permission Rules

- `admin`: edit product profile; manage assets, knowledge, and templates;
  generate content; open Studio; review content.
- `approver`: read the workspace; generate content and open Studio for active,
  configured products; review content; no product administration.
- `member`: read the workspace; generate content and open Studio for active,
  configured products; no product administration or approval action.
- Archived products cannot generate new content or open Studio.
- Products without an active template cannot generate content or open Studio.

The UI may hide or disable controls for clarity, but server actions and RLS
remain the enforcement boundary.

## Empty-State Rules

- Assets: `upload_first_asset` when no product asset exists.
- Knowledge: `add_approved_knowledge` when both sources and approved claims are
  absent; otherwise identify the missing source or claim separately.
- Templates: `configure_template` when no active template exists.
- Content: `generate_first_content` when no product content exists.
- Approvals: `queue_clear` when no product content is in review.

Action URLs are returned only when the viewer has permission to perform the
corresponding action.

## UI Integration Rules

- The product detail route and all future Assets, Knowledge, Templates, Content,
  and Approvals views consume this service or a deliberately extracted slice of
  the same contract.
- Keep fast links to the global Knowledge Hub and Studio, but preserve the
  product ID in navigation.
- Do not query by product name, infer organization from the URL, or use a
  service-role client to render the workspace.
- Do not cache the authenticated workspace across users or organizations.
- Mutations continue through existing server actions; this contract is read-only.

## Verification

- `npm run test:workspace` covers role, lifecycle, configuration, and empty-state
  behavior.
- `npm run test` runs Asset Library and product-workspace contract tests.
- `npm run lint` and `npm run build` must pass before handoff to Claude Code.
