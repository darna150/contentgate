# ContentGate MVP Roadmap

Last updated: 2026-07-06

## Phase 0: Stabilize Live App

Owner: Codex

- Keep production deployable from `main`.
- Keep a clear handoff in `AGENT_HANDOFF.md`.
- Fix server-side approval and export bypasses before adding major UI surface.
- Keep Supabase migrations additive.
- Run build/lint checks before handoff whenever practical.

## Phase 1: Core Integrity

Owner: Codex

- Harden RLS for profiles, documents, generated content, and storage.
- Enforce approval transitions through server actions.
- Block generated creative rendering/export for unapproved content.
- Validate AI evidence against approved claims/source text.
- Add audit events for creation, edits, submit, approval, rejection, and export.

## Phase 2: Brand/Product Workspace MVP

Owner: Codex first, Claude Code second

- Normalize product/brand workspace data.
- Connect each workspace to assets, source docs, templates, generated content, and approvals.
- Add asset library basics: upload, metadata, tags/categories, image/PDF preview, and delete.
- Polish workspace UI after backend rules are stable.

## Phase 3: Template Engine Standardization

Owner: Codex first, Claude Code second

- Make the Apex Canine pattern the official production template standard.
- Keep editable fields, field limits, locked fields, density rules, and overflow policy consistent.
- Add render/stress checks for each active template.
- Claude Code can then calibrate visual spacing, type, and template polish.

## Phase 4: Knowledge Hub

Owner: Codex first, Claude Code second

- Improve source document model and citation validation.
- Persist notebook sessions reliably.
- Add summaries only after source/citation reliability is solid.
- Polish the NotebookLM-style three-pane experience.

## Phase 5: Approval Workflow Polish

Owner: Codex first, Claude Code second

- Add approval/rejection notes and revision history.
- Track who approved/exported what.
- Improve reviewer screens and status indicators.

## Later

- Postgres full-text search, then semantic/vector search if needed.
- Asset analytics.
- Slack, Dropbox, Trello, Canva integrations.
- Real-time collaboration.
- Mobile-specific production flows.

## Do Not Start Yet

- Campaign planning.
- Finance/funds modules.
- Full freeform canvas editing.
- Complex multi-app integrations before the core asset/template/approval loop is reliable.
