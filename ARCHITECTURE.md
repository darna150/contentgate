# ContentGate Architecture

Last updated: 2026-07-06

## Current Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Supabase Auth, Postgres, RLS, and Storage
- Anthropic SDK / AI SDK
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

### Template Studio

Studio is the controlled editing surface for creative output.

Production templates should be locked layouts with explicit editable fields. Users can edit copy and approved image slots, but they should not freely drag or restyle the whole design in the MVP.

Current template architecture:

- `product_templates.layout_key` dispatches to a renderer.
- `editable_fields`, `field_limits`, `locked_fields`, and `template_definition` describe the editing contract.
- Product-specific renderers live in `src/lib/*-render.tsx`.
- `src/lib/render-copy.ts` and `src/lib/template-fields.ts` handle fitting and limits.

### Approval Workflow

Generated content should move through:

`draft` -> `in_review` -> `approved` or `rejected`

Only approved content may be exported or rendered as a final generated asset. UI gating is not enough; API routes and RLS must enforce this too.

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
