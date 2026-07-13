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
- Lint, TypeScript, production build, browser console, and preview runtime-log checks pass.

### Current Gate

- Phase 1 is complete.
- Codex Asset Library backend work is committed, deployed, and verified in Production.
- Authenticated upload, preview, metadata/status edit, audit, database delete, and physical Storage delete all pass.
- The stable contract is ready for Claude Code to build the dedicated `/assets` interface.

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

Status: Backend complete; UI next

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

- Build the Asset Library interface from the established data contract.
- Add grid/list views, search, product/type filters, upload progress, empty states, previews, and metadata editing.
- Keep the interface work-focused, responsive, and consistent with the existing visual system.

Exit criteria:

- Admins can upload, organize, preview, filter, edit, and delete assets.
- Non-admin write access is blocked by both UI and backend policy.
- Assets are associated with the correct organization and product/workspace.

### 3. Make Product Workspaces The Core Navigation Unit

Status: After Asset Library foundation

Owner: Codex first, Claude Code second

Codex:

- Define one workspace query/service that returns product profile, assets, approved sources, claims, templates, content, and approval counts.
- Remove duplicated cross-page data assembly where it creates inconsistent behavior.
- Define workspace-level permission and empty-state rules.

Claude Code:

- Rework the product detail experience into a clear workspace with Assets, Knowledge, Templates, Content, and Approvals views.
- Preserve fast navigation into Knowledge Hub and Studio.
- Complete desktop and mobile visual QA.

Exit criteria:

- Users can understand the complete state of one brand/product without jumping through unrelated screens.
- All workspace views use the same organization/product boundary.

### 4. Standardize The Template Engine

Status: Partially implemented

Owner: Codex first, Claude Code second

Codex:

- Make the Apex Canine implementation the documented template contract.
- Standardize layout keys, editable fields, locked fields, field limits, density rules, overflow checks, and supported output sizes.
- Add automated render/stress checks for every active template and output size.
- Confirm server-rendered and live-canvas templates share the same approval/export rules.
- Hide or deactivate legacy templates that do not meet the contract.

Claude Code:

- Calibrate spacing, typography, imagery, and responsive Studio behavior for Apex Canine, VitalBite, and CaniGuard 5.
- Compare rendered output with the approved Figma/Canva references.
- Fix visual overflow only within the declared template contract.

Exit criteria:

- Every active template passes field-limit and render checks.
- Approved output is visually reliable at every supported size.
- Adding a new template follows one repeatable onboarding process.

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
