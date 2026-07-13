# Claude Code Execution Brief: ContentGate Asset Library UI

Last updated: 2026-07-13

Copy this complete brief into Claude Code at the start of the next implementation session.

---

## Your Role

You are the UI implementation and visual-quality owner for ContentGate.

Your immediate assignment is to build the Phase 2 Asset Library interface on
top of a backend contract that Codex has already implemented, migrated,
secured, deployed, and tested in Production.

Work as a senior product designer and frontend engineer. Read the existing
application before editing it, preserve its architecture and established
patterns, and implement the requested experience end to end. Do not stop at a
mockup or plan.

You own:

- Information architecture and workflow clarity for the Asset Library UI.
- Figma-to-code and visual-system consistency.
- Responsive desktop and mobile behavior.
- Loading, pending, success, error, empty, and permission states.
- Accessible controls and practical interaction details.
- Visual verification after implementation.

Codex owns:

- Product architecture and data contracts.
- Supabase migrations, schema, RLS, and Storage policies.
- Service-role boundaries and server-side authorization.
- Approval/export workflow integrity.
- API security and backend contract changes.
- Backend tests and production audits.

If the UI reveals a genuine backend requirement, document it clearly and hand
it back to Codex. Do not quietly loosen or redesign the backend contract to make
the UI easier to build.

## Repository And Live Environment

- Repository: `/Users/debbiemelgarejo/Documents/Animal-Health-Hub/contentgate`
- Branch: `main`
- Latest reviewed commit at handoff: `4e0047d`
- Production: `https://contentgate-delta.vercel.app`
- Supabase project: `egjssfcenboalijfdmsi`
- Vercel project: `contentgate`
- Framework: Next.js 16 App Router, React 19, Tailwind CSS 4
- Backend: Supabase Auth, Postgres, RLS, and Storage
- AI: Anthropic SDK and Vercel AI SDK
- Hosting: Vercel

Before editing:

1. Run `git status --short --branch` and do not overwrite unrelated work.
2. Read `CLAUDE.md` and the relevant Next.js 16 guides in `node_modules/next/dist/docs/`.
3. Read the source-of-truth files listed below.
4. Inspect the current sidebar, products pages, product edit page, global design tokens, and asset helpers/actions.
5. Confirm the application builds before making broad UI changes.

## Source-Of-Truth Order

Use these files in this order when information conflicts:

1. `PRODUCT_DIRECTION.md`
2. `MVP_ROADMAP.md`
3. `ARCHITECTURE.md`
4. `ASSET_LIBRARY_CONTRACT.md`
5. `AGENT_HANDOFF.md`
6. `PRODUCTION_AUDIT.md`
7. `TEMPLATE_ONBOARDING.md`

`HANDOVER.md` and the older pitch deck describe an earlier regulated
animal-health SaaS direction. They may contain useful historical context, but
they are not the current strategy. Do not reintroduce removed finance or
campaign-management concepts from older materials.

## Product And Business Direction

ContentGate is a brand-safe content production platform for marketing and brand
teams. Its core promise is:

> Approved assets and source knowledge go in; brand-safe, layout-safe content comes out.

The product should feel closer to Sesimi, Brandfolder, Frontify, Marvia,
Bynder, and Canva for Teams than to a campaign planner, finance product, or
generic project-management system.

The initial wedge is not "a giant DAM with every enterprise feature." It is a
tightly connected brand-production workflow:

1. Organize a product or brand workspace.
2. Store approved brand assets, source documents, and claims.
3. Ask grounded questions against approved source knowledge.
4. Generate or adapt copy from that approved evidence.
5. Apply the content to locked, brand-safe creative templates.
6. Submit content for review.
7. Approve or reject it with traceability.
8. Export only approved content.

The practical business value is reduced brand inconsistency, fewer compliance
mistakes, faster content adaptation, less repetitive design work, and a clear
record of what was approved and exported.

One representative use case is an organization producing repeated branded
marketing materials for products, locations, or events. Teams need approved
logos, product images, reusable visuals, source facts, captions, and locked
layouts in one governed workflow rather than scattered drives and ad hoc design
files.

## MVP Definition

The MVP includes:

- Product or brand workspaces.
- A governed Asset Library.
- Approved source documents and product claims.
- A citation-based Knowledge Hub.
- AI-assisted, source-grounded content generation.
- Locked creative templates with declared editable fields.
- Draft, review, approval, rejection, and approval-only export.
- Organization- and role-based access control.
- Useful audit history for important actions.

The MVP explicitly does not include:

- Campaign planning or marketing calendars.
- Funds, budgets, invoices, or finance management.
- Generic project/task management.
- A full freeform Canva-style canvas.
- Real-time multiplayer editing.
- Broad Slack, Trello, Dropbox, or Canva integrations.
- Advanced analytics before the production loop is reliable.
- Sanity CMS for governed application records. Supabase is the system of record.

## Product Principles

- Brand assets must remain accurate and intact.
- Creative templates are controlled, not freely rearranged.
- AI output must be grounded in approved evidence.
- Approval and export rules are enforced server-side.
- UI convenience must never weaken organization, role, approval, or Storage boundaries.
- The app should feel calm, polished, editorial, modern, and work-focused.
- Desktop production reliability comes first, with strong responsive access and review behavior.
- Avoid cartoony AI styling, decorative visual noise, marketing-site composition, and generic dashboard clutter.

## Current Architecture

The workspace/product is the core organizing unit. The main data relationships
are:

- `products`: product or brand workspaces.
- `product_claims`: approved claims used for grounded generation.
- `documents`: approved source knowledge.
- `product_assets`: governed brand/media assets.
- `product_templates`: approved locked creative layouts.
- `generated_content`: generated copy and approval state.
- `audit_log`: important workflow actions.

The application uses Next.js App Router. Prefer Server Components for initial
reads and small client boundaries for filters, view controls, previews, upload
interactions, and mutation feedback.

Browser clients use the normal Supabase client and remain constrained by RLS.
Service-role access stays server-only and is not used for ordinary Asset Library
mutations.

## Completed And Verified Work

Do not rebuild these items:

- Supabase project restored and healthy.
- Profile organization and role fields hardened.
- Source-document and product-asset writes hardened.
- Generated-content draft/review/approval transitions hardened.
- Direct rendering/export of unapproved generated content blocked.
- Draft -> review -> reject -> resubmit -> approve flow verified.
- Approved content-to-Studio product/template handoff fixed.
- Markdown and PNG downloads verified.
- Knowledge Hub notebook sessions implemented.
- Apex Canine established as the template implementation standard.
- VitalBite and CaniGuard 5 active as early locked-template implementations.
- Asset metadata schema, indexes, RLS, Storage policies, actions, filtering helper, and audit events implemented.
- Asset upload validates real image bytes and records dimensions with `sharp`.
- Asset upload, preview, metadata edit, status edit, database delete, physical Storage delete, and audit events verified in Production.
- Supabase reports no Asset Library security-advisor warnings.
- Vercel showed no runtime errors or warning/error/fatal logs during the Asset Library production test.

## Asset Library Backend Contract

Read `ASSET_LIBRARY_CONTRACT.md` before implementation. The key contract is
summarized here.

### Asset Record

`product_assets` is scoped by `org_id` and `product_id` and includes:

- `id`
- `org_id`
- `product_id`
- `asset_type`
- `storage_path`
- `title`
- `description`
- `alt_text`
- `original_file_name`
- `mime_type`
- `file_size_bytes`
- `width_pixels`
- `height_pixels`
- `tags`
- `approval_status`
- `uploaded_by`
- `created_at`
- `updated_at`

MVP asset types:

- `logo`
- `packshot`
- `background`
- `image`

Approval states:

- `pending`
- `approved`
- `rejected`
- `archived`

Accepted uploads:

- PNG
- JPEG
- WebP
- GIF
- AVIF
- Maximum 10 MB

New uploads default to `approved` because upload is admin-only in the MVP.

### Storage Contract

- Bucket: `product-assets`
- Path: `{org_id}/{product_id}/{uuid}-{safe-file-name}`
- The bucket remains public so existing public asset URLs continue to render.
- Public object enumeration is blocked.
- Asset discovery must use `product_assets`, not Storage listing.
- Only authenticated admins have organization-scoped object visibility, upload, and delete permissions.
- Object replacement is not supported. A new version is a new upload.

Do not change any of these rules.

### Existing Server Functions

In `src/app/(app)/products/actions.ts`:

- `uploadProductAsset(productId, formData)`
- `updateProductAssetMetadata(assetId, productId, formData)`
- `deleteProductAsset(assetId, productId)`

These actions already authenticate the admin, enforce organization/product
scope, validate inputs, update Storage/database records, write audit events, and
revalidate relevant paths.

In `src/lib/product-assets.ts`:

- Asset type/status constants and types.
- File validation.
- Text and tag normalization.
- Safe filename and storage-path construction/validation.

In `src/lib/product-assets-server.ts`:

- `listProductAssets(filters)`
- Supported filters: `productId`, `assetType`, `approvalStatus`, `tag`, and title `search`.
- Returns asset metadata, related product identity, role, and public preview URL.

Use these functions. Do not duplicate the validation, path, role, or filtering logic in client code.

## Your Immediate Assignment

Build the dedicated `/assets` Asset Library experience and refine the existing
product asset panel enough that both surfaces feel coherent.

### 1. Add Asset Library Navigation

- Add `Asset Library` to the existing app sidebar, immediately after `Products`.
- Use `/assets` as the route.
- Preserve the existing shell, authentication, organization context, user role, and approval badge behavior.
- Do not reorganize the rest of the application navigation in this phase.

### 2. Build `/assets`

Create a work-focused library for scanning and repeated action, not a marketing
landing page.

Required structure:

- Compact page heading and primary upload action.
- Result count.
- Search by title.
- Product/workspace filter.
- Asset type filter.
- Approval-status filter.
- Tag filter.
- Grid/list segmented view control.
- Clear active-filter state and reset action.
- Grid and list results using the same data contract.
- Useful empty state when the organization has no assets.
- Useful no-results state when filters return nothing.

Prefer URL search parameters for filter state so views are shareable and browser
navigation behaves predictably. Validate search parameters before passing them
to the typed helper.

Initial reads should be server-rendered with `listProductAssets`. It is
acceptable for the page to query the organization-visible products separately
to populate the product filter, but do not bypass existing RLS or create a new
privileged API.

### 3. Grid View

Each asset item should show:

- Accurate image preview using `previewUrl`.
- Title.
- Product/workspace name.
- Asset type.
- Approval status.
- Dimensions when available.
- File type and human-readable file size.
- Tags without overflowing the card.
- Metadata edit action.
- Delete action for admins only.

Keep cards compact, no more than 8px radius unless an existing token requires
otherwise, and avoid cards nested inside cards.

### 4. List View

The list should support fast comparison and include:

- Thumbnail.
- Title and original filename.
- Product/workspace.
- Type.
- Status.
- Dimensions/file size.
- Updated date.
- Admin actions.

Use a responsive table/list pattern that remains readable on mobile. Do not
force a wide desktop table to overflow without a considered mobile alternative.

### 5. Asset Preview And Metadata

Provide an accessible preview drawer or modal with:

- Uncropped, accurate asset preview.
- Complete metadata.
- Product association.
- Tags.
- Status.
- Created/updated information.
- Admin-only metadata edit affordance.

Metadata editing must use `updateProductAssetMetadata`. Include:

- Title, required.
- Alt text.
- Description.
- Comma-separated tags with clear normalization expectations.
- Approval status.

After saving, show pending and success/error feedback and ensure every visible
representation refreshes immediately.

### 6. Upload Experience

The upload experience must use `uploadProductAsset` and include:

- Product/workspace selection.
- Asset type selection.
- File chooser or drop area.
- Optional title.
- Tags.
- Accepted-format and 10 MB constraint near the file control.
- Selected-file name and size before submission.
- Indeterminate upload progress/pending state, since the current server action does not expose byte-level progress.
- Clear validation and server error feedback.
- Success feedback and immediate appearance in the active library view.

Do not claim percentage upload progress unless a real upload-progress transport
exists. If measured percentage progress is necessary, document that as a
backend enhancement for Codex instead of inventing a client-only percentage.

### 7. Delete Experience

- Admin-only.
- Use `deleteProductAsset`.
- Require a confirmation dialog that clearly names the asset.
- Explain that deletion removes both metadata and the stored file.
- Disable repeated submission while pending.
- On success, remove the asset from the current UI immediately.
- On failure, retain the item and show a clear error.

Do not perform direct SQL or direct Storage object deletion from the UI.

### 8. Role Behavior

- Admins: upload, edit metadata/status, and delete.
- Non-admin organization members: read-only library and preview.
- Do not hide data that RLS permits members to read.
- Do not render write controls for non-admins.
- The server/RLS contract remains the final authorization boundary.

### 9. Improve The Existing Product Asset Panel

The current product edit page has a functional asset panel at
`src/app/(app)/products/[id]/edit/page.tsx`.

Keep it as the product-scoped quick-management surface, but align its cards,
metadata editing, pending feedback, success/error feedback, delete confirmation,
and refresh behavior with the new library components. Reuse components rather
than maintaining two visually and behaviorally different asset systems.

Do not redesign unrelated product details, claims, templates, or danger-zone
behavior in this phase.

## Component And State Guidance

Prefer a small, explicit component set such as:

- Asset library page shell.
- Filter toolbar.
- Grid/list view toggle.
- Asset grid.
- Asset list.
- Asset item/row.
- Asset preview dialog or drawer.
- Upload dialog/form.
- Metadata form.
- Delete confirmation.
- Shared status badge and metadata formatting helpers.

Use Server Components for data loading and Client Components only where
interaction requires them. Keep mutation state near the relevant control.

Existing server actions throw on invalid input. Client mutation components may
call them inside a transition and catch returned failures to provide clear
feedback. Do not weaken server validation to make errors easier to display.

Avoid speculative abstractions. Extract shared components only where the
dedicated library and product panel genuinely share behavior.

## Visual Direction

ContentGate should feel:

- Warm minimalist.
- Editorial but operational.
- Clean and modern.
- Calm and trustworthy.
- Brand-focused.
- Designed for repeated daily work.

Follow the existing design tokens in `src/app/globals.css` and the current app
shell. The visual system uses restrained green brand colors, neutral surfaces,
serif page headings, compact controls, and modest radii.

Design constraints:

- Keep page sections unframed; use cards only for actual asset items, modals, and tools.
- Do not place cards inside cards.
- Keep cards at 8px radius or less unless using an established token.
- Avoid oversized hero sections, decorative gradients, blobs, bokeh, and marketing-style layouts.
- Do not make the palette one-note. Use neutral surfaces and semantic status colors alongside the brand green.
- Use familiar icons for view modes, preview, edit, upload, and delete where the project has an appropriate icon solution.
- Prefer symbol/icon controls with tooltips for familiar compact actions.
- Keep text sizes appropriate for an operational dashboard.
- Ensure long names, tags, filenames, and product names cannot overflow their containers.
- Use stable grid tracks, aspect ratios, and control dimensions so content does not shift the layout.
- The asset itself must remain inspectable. Do not blur, repaint, distort, or aggressively crop it.

## Responsive And Accessibility Requirements

Verify at minimum:

- Wide desktop.
- Standard laptop.
- Tablet-width layout.
- Mobile layout.

Requirements:

- No overlapping controls or text.
- No clipped filenames or unbounded tags.
- Keyboard-accessible dialogs, forms, filters, and view controls.
- Visible focus states.
- Labels for every form control.
- Descriptive alt text for previews, with sensible fallbacks.
- Semantic buttons for actions.
- Accessible dialog title/description and focus behavior.
- Status must not rely on color alone.
- Touch targets must remain practical on mobile.

## Non-Negotiable Boundaries

Do not modify without returning the work to Codex:

- Supabase schema or migrations.
- RLS policies.
- Storage policies or bucket privacy.
- Organization or product path format.
- Accepted file types or size limit.
- Service-role usage.
- Audit event behavior.
- Approval state machine.
- Approval-only export and render rules.
- AI evidence/citation validation.
- Locked template contracts.

Also do not:

- Add campaign, calendar, budget, or task-management features.
- Add a freeform design canvas.
- Introduce Sanity or another CMS for application records.
- Replace Supabase with another data layer.
- Rebuild the app with another framework.
- Activate legacy templates that do not meet the Apex standard.
- Change unrelated screens as part of an aesthetic cleanup.

## Acceptance Criteria

The phase is complete only when:

1. `/assets` is reachable from the sidebar.
2. Organization-visible assets load through the established server helper.
3. Search and product/type/status/tag filters work and are represented in the URL.
4. Grid and list views both work and preserve the active filters.
5. Previews show the real asset without distortion.
6. Admin upload succeeds with useful pending/error/success feedback.
7. New uploads appear without a manual browser reload.
8. Admin metadata/status edits persist and refresh every visible representation.
9. Admin delete requires confirmation and removes the card/row immediately after success.
10. Non-admins have a useful read-only experience and no write controls.
11. Empty, no-result, loading, pending, error, and disabled states are implemented.
12. The product edit asset panel uses the same core components/behavior where practical.
13. Desktop and mobile layouts have no overlap, clipping, or unstable card sizing.
14. Existing approval, Studio, Knowledge Hub, product, and content flows remain intact.
15. No backend security or data-contract files are changed.

## Required Verification

Before handoff:

1. Run `git diff --check`.
2. Run `npm run lint`.
3. Run `npm run test:assets`.
4. Run `npm run build`.
5. Start the local development server on an available port.
6. Test authenticated admin behavior for `/assets` and the product asset panel.
7. Test or inspect non-admin rendering without changing RLS.
8. Verify upload, preview, metadata edit, status edit, filter, view-toggle, and delete behavior.
9. Verify the delete flow leaves no visible item after success.
10. Check browser console errors.
11. Capture desktop and mobile screenshots for visual QA.
12. Check that unrelated primary routes still render.

Do not use real customer or personal files for testing. Generate a small,
clearly named temporary image, then delete it and confirm no temporary asset is
left behind.

## Handoff Back To Codex

When finished, provide:

- A concise summary of the implemented experience.
- Exact files changed.
- Routes and components added.
- Verification commands and results.
- Desktop/mobile visual QA notes.
- Any remaining UI limitations.
- Any backend needs discovered, without implementing them.
- Confirmation that RLS, Storage policy, service-role, approval, audit, and export contracts were not changed.
- A note confirming all temporary test assets were deleted.

Do not push or deploy until the diff and verification results have been reviewed
unless Debbie explicitly asks you to do so.

## Final Instruction

Begin by reading the code and the source-of-truth documents. Then implement the
Asset Library UI phase completely. Preserve the stable backend and approval
contracts, keep the scope focused on governed brand assets, and leave the app in
a state that Codex can review, test, and safely deploy.

