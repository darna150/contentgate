# ContentGate Architecture

Last updated: 2026-07-13

## Current Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Supabase Auth, Postgres, RLS, and Storage
- OpenAI Responses API
- Vercel

Do not rebuild or change stacks without a separate architecture decision. The practical path is to harden and organize the existing app.

## Core Modules

### Product/Brand Workspaces

Workspaces are the organizing unit for brand-safe production. A workspace should connect:

- Product or brand profile.
- Approved claims.
- Approved source documents.
- Brand/media assets.
- Locked creative templates.
- Generated content.
- Approval history.

Current tables: `products`, `product_claims`, `documents`, `product_assets`, `product_templates`, `generated_content`.

### Asset Library

The asset library should manage uploaded brand and media assets. The MVP can use Supabase Storage plus Postgres metadata before introducing a larger DAM-style abstraction.

Near-term fields should include owner org, workspace/product, asset type, storage path, title, tags, dimensions, file type, and created metadata.

### Knowledge Hub

Knowledge Hub is the source-grounded assistant layer. It should answer only from approved source documents and claims, return citations, and store useful sessions.

Current tables: `documents`, `knowledge_queries`, `notebook_sessions`.

Phase 5 retrieval uses the security-invoker `search_product_knowledge` RPC to rank explicitly product-assigned document paragraphs with Postgres full-text search. The model sees only the retrieved evidence set, and the server validates every new citation by `(document_id, paragraph_n)` plus verbatim excerpt containment. See `KNOWLEDGE_HUB_CONTRACT.md`.

### Template Studio

Studio is the controlled editing surface for creative output.

Production templates should be locked layouts with explicit editable fields. Users can edit copy and approved image slots, but they should not freely drag or restyle the whole design in the MVP.

Current template architecture:

- `product_templates.layout_key` dispatches to a renderer.
- `editable_fields`, `field_limits`, `locked_fields`, and `template_definition` describe the editing contract.
- New client templates use portable Template Platform bundles: `manifest.json`,
  private `template-bundles` assets, manifest-declared fields, optional DAM
  bindings, and active platform assignments pinned to immutable published
  versions.
- Product-specific renderers and product-template generation are legacy
  read/export compatibility paths. They should not be used for new clients or
  monthly client template refreshes.
- `src/lib/render-copy.ts` and `src/lib/template-fields.ts` handle fitting and limits.

### Approval Workflow

Generated content should move through:

`draft` -> `in_review` -> `approved` or `rejected`

Only approved content may be exported or rendered as a final generated asset. UI gating is not enough; API routes and RLS must enforce this too.

Phase 6 adds `generated_content_revisions` and `generated_content_events` as the
immutable history boundary. Content-bearing changes create numbered snapshots;
submit, approve, reject, revocation, and export events point to the exact
revision they affect. Trusted authenticated RPCs own atomic workflow and export
events, while direct clients remain constrained by RLS and trigger-owned status
fields. See `APPROVAL_HISTORY_CONTRACT.md`.

### AI Generation

AI copy generation must:

- Use approved product claims and source text only.
- Respect field limits.
- Return structured fields.
- Return evidence/citations.
- Store drafts for review.
- Never directly create approved content.

## Security Boundaries

- Browser clients use the normal Supabase client and should be constrained by RLS.
- Service-role clients may bypass RLS only inside server actions/routes that explicitly check user role, org, and workflow state.
- Profile `org_id` and `role` are privileged membership fields.
- Documents and claims are compliance inputs and should be admin-controlled.
- Direct creative render/export URLs must not leak unapproved generated assets.
- Product assets and source documents use private Storage buckets. Authenticated
  server reads issue one-hour signed URLs after organization-scoped RLS checks.
- AI generation and Knowledge Hub calls consume atomic, per-user database rate
  limits before invoking OpenAI.
- `/api/health` checks application-to-database connectivity without returning
  project details; scheduled GitHub Actions monitor the Production alias.

## Release Boundary

- Pull requests must pass migration integrity, dependency audit, lint,
  TypeScript, all focused tests, template rendering, and the production build.
- Vercel creates a Preview for each branch. Only reviewed PRs merge to `main`,
  which is the Production deployment source.
- Database migrations are additive. Risky delivery changes, such as switching a
  bucket from public URLs to signed URLs, are sequenced after compatible code is live.
- See `LAUNCH_RUNBOOK.md` for smoke tests, incident response, and rollback.

## Agent Ownership

Codex owns:

- Architecture and data model.
- RLS and server-side workflow rules.
- API hardening.
- Tests, build checks, migrations, and handoff docs.

Claude Code owns:

- Visual design implementation.
- Figma-to-UI polish.
- Template calibration.
- Studio UX details.
- Visual QA after backend rules are stable.
