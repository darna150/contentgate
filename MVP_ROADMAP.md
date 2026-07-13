# ContentGate MVP Execution Plan

Last updated: 2026-07-13

## Product Goal

Ship a focused brand-safe content production MVP where approved knowledge and assets feed locked templates, content moves through a controlled review workflow, and only approved output can be exported.

The MVP is not a campaign planner, finance platform, project-management suite, or freeform Canva replacement.

## Current Status

### Completed

- Product direction, architecture, ownership, template onboarding, and production audit documented.
- Supabase project restored and hardening migration applied to the live database.
- Profile membership fields, source documents, product asset storage, and generated-content writes protected with stricter RLS.
- Submit, approve, and reject transitions moved behind trusted server actions.
- Direct creative rendering blocked for unapproved generated content.
- AI evidence filtered against approved claims and source paragraphs before storage.
- Authenticated draft -> review -> reject -> resubmit -> approve workflow verified on Vercel Preview.
- Approved content-to-Studio handoff fixed and verified with VitalBite.
- Reviewed commits pushed to GitHub and deployed to Production at commit `a5a17f5`.
- Production login protection, dashboard routing, export authorization, and runtime logs checked.
- Asset Library metadata, storage, permission, mutation, filtering, and audit contract implemented.
- Asset Library migrations applied and verified on the live Supabase project.
- Dedicated Asset Library UI implemented and reviewed locally, including grid/list views, URL filters, preview, metadata editing, upload, delete confirmation, and role-aware controls.
- Asset Library UI committed as `52d6abb`, pushed on `codex/asset-library-ui`, opened as draft PR #1, and deployed to Vercel Preview.
- Authenticated Preview admin upload, preview, metadata edit, combined filtering, list view, and delete cleanup all pass with no warning/error/fatal runtime logs.
- Authenticated Preview member controls and live RLS denial verified with a temporary account; the account and all test data were removed.
- Public user creation hardened so organization and role assignments require a short-lived server-only provisioning record.
- Shared mobile app navigation corrected so primary app surfaces remain usable at phone widths.
- Lint, TypeScript, production build, browser console, and preview runtime-log checks pass.
- Asset Library PR #1 merged to `main` at `239db7c` and deployed successfully to Production.
- Authenticated Production Asset Library and dashboard smoke tests pass with no runtime errors.
- Phase 3 product-workspace read, permission, count, and empty-state contract implemented and tested.
- Phase 3 product workspace UI implemented with Assets, Knowledge, Templates, Content, and Approvals views on one shared read boundary.
- Codex review closed product-lifecycle and Knowledge Hub context gaps, including direct template/API generation enforcement for non-active products.

### Current Gate

- Phases 1 and 2 are complete and verified in Production.
- Phase 3 implementation and Codex review fixes are complete on `codex/product-workspaces`.
- Corrected Preview admin/member/approver role QA is complete; the disposable role accounts and provisioning records were removed.
- Draft PR #2 is ready for final release review, merge, and Production verification.
- Phase 4 engineering is complete on `codex/template-engine-standardization`; its additive contract metadata migration is applied and verified live.
- Phase 4 code release must follow the Phase 3 merge. Final template visual calibration is deferred until the replacement Figma frames are approved.

## Execution Order

Work in this order. Do not start a later UI phase while its backend contract is still changing.

### 1. Release The Stabilized Foundation

Status: Complete

Owner: Codex, with one manual download check by Debbie

Codex:

- Confirm the local branch is clean and review every commit ahead of GitHub.
- Push the reviewed commits to GitHub.
- Confirm the Git/Vercel preview matches commit `8f1325c` or a later reviewed commit.
- Promote the verified deployment to Production only after download confirmation.
- Check production login, dashboard, content detail, Studio handoff, and runtime errors.
- Record the production deployment ID and verification result in `PRODUCTION_AUDIT.md`.

Debbie:

- Click `Download .md` on the approved content page.
- Click `Download PNG` in Studio.
- Confirm both files open and contain the expected VitalBite content.

Exit criteria:

- GitHub, local `main`, and Production point to the same reviewed code.
- The approved workflow and both download types work in Production.
- No new warning/error/fatal runtime logs appear during smoke testing.

### 2. Build The Asset Library Foundation

Status: Complete

Owner: Codex first, Claude Code second

Codex:

- Completed: audited the existing table, public bucket, paths, actions, and policies.
- Completed: defined the governed metadata contract in `ASSET_LIBRARY_CONTRACT.md`.
- Completed: applied additive metadata, index, RLS, and storage-policy migrations.
- Completed: implemented verified image upload, metadata edit, filtering/preview data, and safe delete behavior.
- Completed: added upload, update, and delete audit events.
- Completed: added storage-path unit tests and exercised allow/deny RLS behavior on the live database.
- Completed: production smoke testing caught and fixed the Storage API's need for scoped admin object visibility during delete.

Claude Code, after Codex handoff:

- Completed: built the Asset Library interface from the established data contract.
- Completed: added grid/list views, URL-backed search and filters, upload pending feedback, empty states, previews, metadata editing, and delete confirmation.
- Completed: kept the interface work-focused and consistent with the existing visual system.

Codex review:

- Completed: verified no backend, migration, RLS, Storage, service-role, or audit contract changes were introduced by the UI pass.
- Completed: fixed a race between debounced title search and other URL filters.
- Completed: replaced the fixed mobile sidebar with a responsive mobile header and navigation drawer.
- Completed: added modal keyboard focus containment and prevented archived products from being offered for upload.
- Completed: reran lint, focused tests, production build, desktop/mobile layout checks, and browser console checks.
- Completed: committed and pushed the reviewed UI, opened draft PR #1, and deployed commit `52d6abb` as Vercel Preview `dpl_3A9W8nPQENe7YmFpTZPhNWDXx24y`.
- Completed: ran the authenticated admin upload, preview, metadata edit, combined-filter/list-view, and delete-cleanup workflow with no Preview runtime errors.
- Completed: verified the read-only member UI and live Asset Library insert denial through RLS; removed the temporary Auth user, profile, and all test markers.
- Completed: blocked magic-link account creation and replaced editable-metadata membership assignment with a server-only provisioning handshake.
- Completed: deployed authentication hardening commit `47d5056` as Vercel Preview `dpl_9aob3SNXBpGHobUvvuGntn9Y9bAf`.
- Completed: verified unprovisioned magic-link signup is rejected, trusted member provisioning/password login succeeds, all temporary records are removed, and no Preview build/runtime errors appear.
- Completed: merged PR #1 as `239db7c`, deployed Production `dpl_Ev74i2D367mSH9QPvFSnmCvwf5Qe`, and passed authenticated and unauthenticated smoke checks with no runtime errors.

Exit criteria:

- Admins can upload, organize, preview, filter, edit, and delete assets.
- Non-admin write access is blocked by both UI and backend policy.
- Assets are associated with the correct organization and product/workspace.

### 3. Make Product Workspaces The Core Navigation Unit

Status: Preview QA complete; Production promotion pending

Owner: Codex first, Claude Code second

Codex:

- Completed: defined `getProductWorkspace(productId)` to return the org-scoped product profile, assets, sources, claims, active templates, content, approval queue, and counts.
- Completed: moved the product detail route onto the shared service instead of assembling profile, product, claims, sources, and templates itself.
- Completed: defined tested admin/approver/member, archived-product, template-readiness, and section empty-state rules.
- Completed: documented the UI and security boundary in `PRODUCT_WORKSPACE_CONTRACT.md`.

Claude Code:

- Completed: reworked the product detail experience into Assets, Knowledge, Templates, Content, and Approvals views.
- Completed: preserved navigation into Knowledge Hub, template detail, content, approvals, and Studio.
- Completed: ran desktop and mobile visual QA on the initial Preview implementation.

Codex review:

- Completed: verified all five views consume `getProductWorkspace(productId)` without adding UI-specific Supabase queries.
- Completed: moved template detail onto the shared workspace contract and made non-active product/template views reference-only.
- Completed: enforced active-product lifecycle rules inside the generation API before loading knowledge or calling the model.
- Completed: made Knowledge Hub links product-aware and added deterministic product/session selection.
- Completed: added inactive/archived generation and Knowledge Hub navigation regression tests.
- Completed: ran authenticated admin/member/approver QA on the corrected Preview. Active configured products allow generation for all three roles; administration is admin-only; approval actions are approver/admin-only; inactive products expose no Generate or Studio control.
- Completed: verified product-scoped Knowledge Hub navigation, all five settled workspace views, and a clean browser console.
- Completed: signed out and deleted the disposable member and approver Auth users; zero profiles and zero provisioning records remain.
- Pending: merge PR #2 and verify Production. A live `409` probe was not run because the current inactive product has no active template and creating that condition would mutate shared Production data; the lifecycle guard remains covered by focused regression tests and code review.

Exit criteria:

- Users can understand the complete state of one brand/product without jumping through unrelated screens.
- All workspace views use the same organization/product boundary.

### 4. Standardize The Template Engine

Status: Engineering complete; Figma visual calibration intentionally deferred

Owner: Codex first, Claude Code second

Codex:

- Completed: made the active Apex Canine pattern a versioned registry shared by Studio, generation, workspace readiness, review, approval, preview, and export.
- Completed: standardized layout keys, editable fields, locked fields, field limits, density rules, overflow checks, and supported output sizes for all active templates.
- Completed: added contract and nonblank PNG render/stress checks for every active template and output size.
- Completed: enforced the same declared sizes and approval/export boundary for server rendering and live canvas.
- Completed: kept all unregistered legacy templates inactive and blocked active contract drift in both code and database metadata.
- Completed: added a normalized design-source boundary so Canva metadata can move to Figma without changing generation or approval workflows.

Claude Code:

- Deferred by product decision: calibrate spacing, typography, imagery, and responsive Studio behavior after the replacement Figma templates are approved.
- Deferred: compare rendered output with the approved Figma frames and fix visual differences only within the declared template contract.

Exit criteria:

- Complete: every active template passes field-limit and render checks.
- Deferred until Figma migration: final pixel comparison against the replacement approved designs.
- Complete: adding a new template follows one repeatable onboarding process documented in `TEMPLATE_ENGINE_CONTRACT.md` and `TEMPLATE_ONBOARDING.md`.

### 5. Strengthen Knowledge Hub Reliability

Status: Core session experience exists

Owner: Codex first, Claude Code second

Codex:

- Audit document ingestion, paragraph identity, citations, and notebook persistence.
- Ensure answers cite only approved, accessible organization sources.
- Add explicit no-evidence behavior instead of unsupported answers.
- Add source/citation regression tests before adding semantic search.
- Start with Postgres full-text search; add embeddings only when measured retrieval quality requires them.

Claude Code:

- Polish the three-pane NotebookLM-style experience.
- Improve source selection, citation inspection, loading, empty, and mobile states.
- Keep AI responses secondary to visible approved evidence.

Exit criteria:

- Saved sessions reload reliably.
- Every supported answer has inspectable approved citations.
- Unsupported questions fail clearly and safely.

### 6. Complete Approval History And Auditability

Status: Core state transitions verified; history is incomplete

Owner: Codex first, Claude Code second

Codex:

- Confirm audit events cover create, generate, manual edit, submit, reject, approve, export, and approval revocation after editing.
- Add immutable revision snapshots or a revision table for generated content.
- Record export actor, format, content revision, and timestamp.
- Add reviewer/author permission tests.

Claude Code:

- Build revision history, reviewer notes, comparison states, and clearer approval-queue filters.
- Make status and next action obvious without adding campaign-management concepts.

Exit criteria:

- The team can answer who changed, approved, rejected, or exported each version.
- Editing approved content reliably creates a new draft/review cycle.

### 7. MVP Launch Readiness

Status: Later in MVP

Owner: Codex for engineering gates, Claude Code for visual QA

Codex:

- Add CI for lint, TypeScript/build, migration checks, and template render tests.
- Establish a preview-branch and reviewed-promotion workflow.
- Resolve relevant Supabase advisor warnings, including function search paths and service-function grants.
- Review storage privacy, upload validation, rate limits, secrets, backups, and monitoring.
- Add a small production smoke-test checklist and rollback procedure.

Claude Code:

- Complete responsive QA on the primary user journeys.
- Verify loading, empty, error, disabled, and permission-denied states.
- Run a final consistency pass against the design source of truth.

Exit criteria:

- A new customer organization can complete the core workflow without developer intervention.
- CI and deployment gates prevent known security and template regressions.
- Operational monitoring and rollback steps are documented.

## Later, After MVP Validation

- Asset usage analytics and reporting.
- Semantic/vector search after full-text retrieval is measured.
- Slack, Dropbox, Trello, and Canva integrations.
- Real-time multi-user editing.
- Advanced localization workflows.
- Mobile-specific production flows beyond responsive review and access.

## Do Not Prioritize

- Campaign planning or calendars.
- Funds, budgets, invoicing, or finance features.
- Generic project/task management.
- Full freeform canvas editing.
- Broad integrations before the asset/template/approval loop is reliable.
- Sanity CMS for core application records. Supabase should remain the system of record for governed assets, templates, permissions, and approvals.

## Agent Handoff Rule

Each Codex phase ends with:

- A stable backend/data contract.
- Applied additive migrations where needed.
- Passing lint/build/tests.
- Updated `AGENT_HANDOFF.md` and `PRODUCTION_AUDIT.md`.
- A preview URL and explicit list of surfaces Claude Code may change.

Each Claude Code phase ends with:

- Visual QA notes for desktop and mobile.
- No changes to RLS, trusted workflow transitions, approval/export rules, or service-role boundaries unless returned to Codex for review.
- A clear handoff describing changed components and any backend needs discovered during UI work.
