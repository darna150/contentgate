# ContentGate — Full Build Handover

> **Purpose:** Complete, self-contained handover for any AI coding assistant (Claude Code, Codex, Cursor, etc.) to pick up the build. Covers architecture, database schema, every route, every component, current seed data, known gaps, and next tasks.

---

## 1. What ContentGate Is

A B2B SaaS MVP for **compliant content automation in regulated industries**. The beachhead vertical is **animal health** (veterinary pharmaceuticals, animal nutrition). Every piece of generated marketing content — social posts, flyers, emails — is grounded only in pre-approved claims and source documents. Nothing is invented. Everything is locked and auditable.

**Demo org:** DarnaVet (`industry = "Animal Health"`)
**Two demo users in Supabase Auth:**
- **Admin** — owner/operator; sees full product management + admin panels
- **Member** — field rep persona; sees Products, Knowledge Hub, Content, Approvals

---

## 2. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.9, App Router, React 19 |
| Language | TypeScript 5, strict |
| Styling | Tailwind CSS v4 |
| Database | Supabase (Postgres + RLS + Auth) |
| AI | Anthropic SDK `^0.104.1` |
| AI models | Knowledge Hub: `claude-sonnet-4-6` · Content generation: `claude-opus-4-8` |
| Hosting | Vercel |
| Storage | Supabase Storage — buckets: `documents` (private), `product-assets` (public) |

**Working directory:** `~/Documents/Animal-Health-Hub/contentgate`

**Dev server:** `npm run dev` → port 3000
**Preview server (Claude Code):** launch config `contentgate` → port 3001. After wiping `.next`, stop then restart the preview server or it will 500.

**Required env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`

---

## 3. Database Schema (complete)

All migrations are in `supabase/migrations/`. They are **additive only** — no drops.

### Migration 1 — `20260612000001_init.sql`

```sql
create type user_role as enum ('admin', 'approver', 'member');
create type content_status as enum ('draft', 'in_review', 'approved', 'rejected');

organizations   (id, name, industry, created_at)
profiles        (id → auth.users, org_id, role: user_role, full_name, created_at)
documents       (id, org_id, uploaded_by, title, storage_path, content_text,
                 paragraphs jsonb,   -- [{"n":1,"text":"..."}]
                 product text,       -- legacy grouping label
                 created_at)
templates       (id, org_id, name, description, prompt_body, output_type, created_at)
                -- LEGACY: no longer used after the product-centric pivot
generated_content (id, org_id, created_by, template_id, source_document_ids uuid[],
                   citations jsonb, title, body, audience, target_language,
                   status: content_status, approved_by, approved_at, rejection_note,
                   created_at, updated_at)
audit_log       (id bigint, org_id, actor_id, action, entity_type, entity_id,
                 detail jsonb, created_at)
```

Security-definer helpers (prevent RLS recursion):
```sql
auth_org_id() → uuid      -- calling user's org
auth_role()   → user_role -- calling user's role
```

Triggers:
- `generated_content_guard` — editing the `body` of an `approved` row reverts it to `draft`
- `on_auth_user_created` — new Auth user → auto-creates a `profiles` row (org + role from invite metadata)

Storage bucket: `documents` (private), paths `{org_id}/{document_id}`

---

### Migration 2 — `20260613000001_products.sql`

```sql
products (id, org_id, name, description, disclaimer_text,
          status: 'active'|'archived', created_at)

product_claims (id, org_id, product_id, claim_text,
                status: 'approved'|'inactive', created_at)

product_assets (id, org_id, product_id,
                asset_type: 'logo'|'packshot'|'background'|'image',
                storage_path, created_at)

product_templates (id, org_id, product_id,
                   category: 'social'|'flyer',
                   variant text,             -- e.g. 'Educational Post'
                   layout_key text,          -- maps to code: 'social_v1' | 'flyer_v1'
                   editable_fields jsonb,    -- ordered list of field keys
                   generation_instructions text,
                   preview_image text,
                   status: 'active',
                   sort_order int, created_at)

-- Columns added to existing tables:
documents.product_id           → products(id) on delete set null
generated_content.product_id          → products(id) on delete set null
generated_content.product_template_id → product_templates(id) on delete set null
generated_content.structured_fields   jsonb default '{}'
```

RLS: org-scoped reads for all roles; writes are admin-only (enforced in server actions via service role).
Storage bucket: `product-assets` (public), paths `{org_id}/...`

---

### Migration 3 — `20260614000001_knowledge_queries.sql`

```sql
knowledge_queries (id, org_id, product_id, user_id, question,
                   not_found boolean, citation_count int, created_at)
```

RLS: admins read full org log; members read own rows only; members insert own rows only.

---

### Migration 4 — `20260614000002_knowledge_query_answers.sql`

```sql
alter table knowledge_queries
  add column answer    text,
  add column citations jsonb not null default '[]';
```

Answers are stored so member history loads instantly — no second API call needed.

---

### Seed data (applied manually via Supabase SQL editor)

**Products:**

| Product | Claims | Templates |
|---|---|---|
| DigestPro | 6 approved | 2 social (Educational Post, Product Highlight) + 1 flyer (Product Flyer) |
| PoultryShield Pro | 4 approved | **None yet** |
| SwineGuard Plus | 4 approved | **None yet** |

DigestPro has at least 1 source document uploaded. The other two products have no source documents.

---

## 4. Route Map

All authenticated routes live under `src/app/(app)/`. The layout at `src/app/(app)/layout.tsx` wraps every app page in the Sidebar and requires auth.

### Public routes

| Route | File |
|---|---|
| `/` | `src/app/page.tsx` — redirects to `/dashboard` if logged in, else `/login` |
| `/login` | `src/app/login/page.tsx` + `login-form.tsx` |
| `/auth/callback` | `src/app/auth/callback/route.ts` — PKCE handler |

### App routes (auth required)

| Route | File | Access |
|---|---|---|
| `/dashboard` | `(app)/dashboard/page.tsx` | All roles |
| `/products` | `(app)/products/page.tsx` | All; admin sees "+ New product" |
| `/products/new` | `(app)/products/new/page.tsx` | Admin only (redirects members) |
| `/products/[id]` | `(app)/products/[id]/page.tsx` | All; admin sees "Edit" button |
| `/products/[id]/edit` | `(app)/products/[id]/edit/page.tsx` | Admin only |
| `/ask` | `(app)/ask/page.tsx` | All; admin sees ActivityPanel |
| `/content` | `(app)/content/page.tsx` | All roles |
| `/content/[id]` | `(app)/content/[id]/page.tsx` | All; author/approver can act |
| `/approvals` | `(app)/approvals/page.tsx` | All; admin/approver see action buttons |
| `/knowledge` | `(app)/knowledge/page.tsx` | Admin only (in ADMIN_NAV) |
| `/knowledge/new` | `(app)/knowledge/new/page.tsx` | Admin only |
| `/knowledge/[id]` | `(app)/knowledge/[id]/page.tsx` | Admin only |
| `/studio` | `(app)/studio/page.tsx` | Exists; access TBD |

### API routes

| Route | File | Purpose |
|---|---|---|
| `POST /api/products/generate` | `api/products/generate/route.ts` | Content generation. Calls `claude-opus-4-8` with `tool_choice: build_asset_content`. Returns `{contentId, structured_fields, evidence, title}`. Writes to `generated_content`. Handles in-place revision via `replaceContentId`. |
| `POST /api/products/ask` | `api/products/ask/route.ts` | Knowledge Hub Q&A. Calls `claude-sonnet-4-6` with `tool_choice: answer_question`. Returns `{answer, citations, not_found}`. Logs to `knowledge_queries`. |
| `GET /api/creative/render` | `api/creative/render/route.tsx` | Renders locked asset as PNG via satori/next-og. Params: `?content={contentId}&size={sizeKey}` |
| `GET /api/creative/template-preview` | `api/creative/template-preview/route.tsx` | Same renderer with placeholder copy. Params: `?template={templateId}&size={sizeKey}` |
| `GET /api/export/[id]` | `api/export/[id]/route.ts` | PNG download of approved content |

---

## 5. Server Actions

Form mutations use Next.js Server Actions (`"use server"`). They are not API routes — they run server-side and are called directly from `<form action={...}>`.

### `src/app/(app)/products/actions.ts`

All gated by `getAdminOrgId()` which throws if `role !== 'admin'`.

| Action | What it does |
|---|---|
| `createProduct(formData)` | Insert into `products`, redirect to new product page |
| `updateProduct(productId, formData)` | Update name/description/disclaimer, redirect to product detail |
| `addClaim(productId, formData)` | Insert into `product_claims` with `status: 'approved'`, revalidate edit page |
| `setClaimStatus(claimId, productId, status)` | Toggle claim `approved` ↔ `inactive` |
| `deleteClaim(claimId, productId)` | Delete claim row |
| `archiveProduct(productId)` | Set `status: 'archived'`, redirect to `/products` |

### Other action files

- `src/app/(app)/content/actions.ts` — content status transitions
- `src/app/(app)/knowledge/actions.ts` — document upload and deletion

---

## 6. Key Library Files

### `src/lib/creative-layout.tsx`

**The single source of truth for visual asset design.** Used by both the render route (real approved content) and the preview route (placeholder). The design is locked — users can never edit it.

- Color palette: dark green gradient `#12312B → #0E5F58`, white text, mint accent `#A9D3C6`
- Supports two `layoutKey` values:
  - `"social_v1"` — square / story / feed social post
  - `"flyer_v1"` — A4 flyer
- Rendered via **satori** (flexbox only — no CSS grid, no `position: absolute`, no `transform`, no `calc()`)
- Field keys used: `headline`, `subheadline`, `body`, `benefit_1`, `benefit_2`, `benefit_3`, `cta`, `key_takeaway`, `contact`, `territory`

**To add a new layout:** add a new `else if (layoutKey === "my_layout_v1")` branch in `AssetLayout()`. Same function signature, flexbox-only CSS, inline `style={{}}` objects only (no Tailwind classNames inside satori). Then insert a `product_templates` row with the matching `layout_key`.

### `src/lib/creative.ts`

```typescript
SIZES = {
  square: { w: 1080, h: 1080 },
  story:  { w: 1080, h: 1920 },
  feed:   { w: 1200, h: 630  },
  a4:     { w: 1240, h: 1754 },
}
CATEGORY_SIZES = { social: ['square','story','feed'], flyer: ['a4'] }
defaultSizeFor(category: string): SizeKey
renderUrl(contentId: string, size: SizeKey): string
```

### `src/lib/templates.ts`

- `fieldLabel(key)` — human-readable label for a field key
- `flattenFields(structured, keys)` — collapses `structured_fields` object into a readable `body` string
- `revisionInstruction(key)` — maps a revision key to an extra model instruction
- `Evidence` type: `{ field: string; approved_source: string }`

### `src/lib/generation.ts`

`buildSystemPrompt(brief)` and `buildUserPrompt(docs, brief)` — used by the older `/api/generate` route. The newer `/api/products/generate` builds its prompts inline.

### `src/lib/paragraphs.ts`

`Paragraph` type: `{ n: number; text: string }`. Documents store text as numbered paragraphs in the `paragraphs jsonb` column so the model can cite by `¶N`.

### `src/lib/supabase/server.ts`
`createClient()` — server-side Supabase client with cookie-based session. Used in Server Components and API routes.

### `src/lib/supabase/admin.ts`
`createAdminClient()` — uses `SUPABASE_SERVICE_ROLE_KEY`. Bypasses RLS. Used only for audit_log inserts.

### `src/lib/supabase/client.ts`
`createClient()` — browser-side Supabase client. Used only in Client Components (sidebar sign-out).

---

## 7. Component Map

### `src/components/sidebar.tsx`

Client component. Nav order for **admin**: Dashboard → Products → Source Documents → Knowledge Hub → Content → Approval Queue. For **member**: same minus Source Documents. Shows pending badge count on Approval Queue.

### `src/components/status-pill.tsx`

Colored pill for content status: `draft`, `in_review`, `approved`, `rejected`.

### `src/app/(app)/products/[id]/generate-variant.tsx`

Client component — the "Generate" button on the product detail page. Calls `POST /api/products/generate`, then navigates to `/content/[newId]`.

### `src/app/(app)/ask/ask-client.tsx`

Client component. Product selector → question textarea → submit → conversation thread (question bubble dark + answer card + citation cards). Empty state shows tappable starter questions that auto-submit. Switching products clears the thread.

### `src/app/(app)/ask/member-history.tsx`

Client component. Collapsible list of user's last 10 questions. Click to expand: shows saved answer + citations from the DB row — no second API call.

### `src/app/(app)/ask/activity-panel.tsx`

Admin-only server component. Shows: total questions count, outside-approved-sources count, recent questions list (product, asker `full_name`, question, timestamp, "No match" badge if `not_found`).

### `src/app/(app)/content/[id]/editor.tsx`

Client component. Inline editing of `structured_fields` + re-generation via `POST /api/products/generate` with `replaceContentId`.

### `src/app/(app)/content/[id]/structured-review.tsx`

Evidence trail per field — which approved claim or source sentence backs each field.

### `src/app/(app)/content/[id]/approval-actions.tsx`

Submit for review / Approve / Reject buttons.

### `src/app/(app)/content/[id]/export-buttons.tsx`

Size selector + PNG download via `/api/export/[id]`.

---

## 8. Content Generation Flow (end-to-end)

1. User visits `/products/[id]` → template cards loaded from `product_templates`
2. Preview thumbnails fetched from `/api/creative/template-preview?template=[id]&size=[size]`
3. User clicks "Generate" → `GenerateVariant` calls `POST /api/products/generate`
4. API loads product's approved claims + source doc paragraphs from Supabase
5. Calls `claude-opus-4-8` with `tool_choice: build_asset_content`. Tool schema mirrors `editable_fields`. Returns `{fields, evidence}`
6. Written to `generated_content` (`structured_fields`, `body`, `product_id`, `product_template_id`). Audit log entry via service role.
7. User redirected to `/content/[id]`
8. Content detail: structured fields + evidence trail + export buttons
9. Author submits for review → approver approves → status: `approved`
10. Export renders locked PNG via `/api/creative/render?content=[id]&size=[size]` → `AssetLayout` via satori

---

## 9. Knowledge Hub Flow (end-to-end)

1. User visits `/ask`. Products loaded. User's last 10 questions loaded from `knowledge_queries` (server render)
2. `AskClient`: product selector → question input → submit
3. `fetch POST /api/products/ask` with `{productId, question}`
4. API loads product claims + doc paragraphs → grounding system prompt → calls `claude-sonnet-4-6` with `tool_choice: answer_question`
5. Tool schema: `{ answer: string; citations: [{document_title, excerpt}][]; not_found: boolean }`
6. Row inserted into `knowledge_queries` (includes `answer` + `citations` for history)
7. Response rendered as conversation bubble + citation cards in `AskClient`
8. `MemberHistory` shows last 10 questions — fully client-side from server-rendered props
9. Admin sees `ActivityPanel` — joins `knowledge_queries` with `products(name)` and `profiles(full_name)`

---

## 10. Patterns to Follow

### Admin-only UI check (server component)
```tsx
const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
const isAdmin = me?.role === "admin";
// then: {isAdmin && <AdminOnlyThing />}
```

### Server action gate
```typescript
async function getAdminOrgId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase
    .from("profiles").select("org_id, role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Admins only");
  return { supabase, orgId: profile.org_id as string, userId: user.id };
}
```

### Claude tool-use (structured output — both AI routes use this)
```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-6",        // or claude-opus-4-8 for content gen
  max_tokens: 1024,
  system,
  tools: [{ name: "answer_question", description: "...", input_schema: { ... } }],
  tool_choice: { type: "tool", name: "answer_question" },
  messages: [{ role: "user", content: question }],
});
const toolUse = response.content.find((b) => b.type === "tool_use");
const result = toolUse.input as { answer: string; citations: [...]; not_found: boolean };
```

### Parallel Supabase queries
```typescript
const [{ data: claims }, { data: docs }] = await Promise.all([
  supabase.from("product_claims").select(...).eq("product_id", id),
  supabase.from("documents").select(...).eq("product_id", id),
]);
```

### Adding a new layout to `creative-layout.tsx`
1. Add `else if (layoutKey === "my_layout_v1")` branch in `AssetLayout()`
2. Flexbox only — no `display: grid`, `position: absolute`, `transform`, `calc()`
3. All styles as inline `style={{}}` objects — no Tailwind classNames
4. Insert a `product_templates` row with matching `layout_key` and `editable_fields`
5. Preview and render routes pick it up automatically — no other changes needed

To render an image (logo/packshot) inside satori: fetch the URL, convert to base64 data URI, pass as `src` prop on an `<img>` element inside the satori tree.

---

## 11. Design System Tokens (Tailwind CSS v4)

| Token | Meaning |
|---|---|
| `bg-brand` / `text-brand` | Primary brand green |
| `bg-brand-dark` | Darker green for avatars/icons |
| `bg-brand-tint` | Light green for active nav bg |
| `text-ink` / `text-ink-muted` / `text-ink-faint` | Text hierarchy: primary / secondary / metadata |
| `bg-surface` | Card/panel background |
| `bg-page` | Page background |
| `border-edge` / `border-edge-strong` | Border hierarchy |
| `text-approve` / `bg-approve-tint` | Green success states |
| `text-reject` / `bg-reject-tint` / `border-reject-border` | Red danger/rejected states |
| `rounded-card` | Card border radius |
| `rounded-control` | Button/input border radius |

Typography: `font-serif` for headings, sans-serif body.

---

## 12. Known Gaps / Pending Tasks

Ordered by priority for demo readiness.

### [1] Templates for PoultryShield Pro and SwineGuard Plus — BLOCKS GENERATION

Both products have claims but zero `product_templates` rows. Can't generate content for them.

**Quick fix via SQL:**
```sql
-- Get IDs first:
select id, name from organizations limit 1;
select id, name from products;

-- Then insert for each product (replace UUIDs):
insert into product_templates
  (org_id, product_id, category, variant, layout_key, editable_fields, generation_instructions, sort_order)
values (
  '<org_id>',
  '<product_id>',
  'social',
  'Educational Post',
  'social_v1',
  '["headline","body","benefit_1","benefit_2","cta"]',
  'Write an educational social post for field reps. Lead with a bold, specific headline. List two practical field benefits. End with a CTA to discuss with vet contacts.',
  1
);
```

### [2] Product asset uploads (logo, packshot) — BIG VISUAL UPGRADE

`product_assets` table and `product-assets` bucket already exist. No UI yet.

What to build:
- Upload form on the `/products/[id]/edit` page (admin only)
- Server action using Supabase storage upload with the service role client
- Read the asset in `AssetLayout` — fetch signed URL → base64 data URI → `<img>` in satori tree

### [3] User invite flow — NEEDED BEFORE PILOT USERS

No way to add members without going into Supabase Auth manually.

What to build:
- Admin form at `/settings/invite` (or on a settings page)
- Server action: `supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: { org_id, role, full_name } })`
- Uses the service role client (`createAdminClient()`)

### [4] Profile full_name is null — COSMETIC BUT VISIBLE

Both demo users show "?" initials in the sidebar and activity panel.

Quick fix:
```sql
update profiles set full_name = 'Admin Name' where role = 'admin';
update profiles set full_name = 'Member Name' where role = 'member';
```

### [5] Rate limiting on Knowledge Hub — PRE-ROLLOUT

Currently unlimited queries per user.

Where to add it: `src/app/api/products/ask/route.ts`, before the Anthropic call — count rows in `knowledge_queries` for `user_id` in the last 24h, return 429 if over limit.

### [6] Source documents for PoultryShield Pro + SwineGuard Plus

Both have no documents uploaded. The Knowledge Hub will return `not_found: true` for most questions until documents are added. Add via `/knowledge/new?product=[id]`.

### [7] Template management UI (optional)

Currently templates are SQL-only. An admin UI on the edit product page would let non-technical admins add/edit templates. Not critical for demo.

---

## 13. Git State

**Branch:** `main`
**Last commit:** `800053c` — Product Management UI (create/edit products, manage claims, archive, seed PoultryShield Pro + SwineGuard Plus)

**Untracked files (not committed, intentionally):**
- `.env` / `.env.example` — environment variables
- `Design/` — design reference files
- Asset folders (`Missio-Assets/`, `Product Photos True Legacy/`, etc.)

---

## 14. Where to Start Next Session

**Fastest path to a more complete demo:**

1. Run the SQL inserts from Gap [1] to add templates for the two new products — 10 min
2. Add source documents for those products via `/knowledge/new` — content hours
3. Fix `full_name` via SQL from Gap [4] — 2 min

**Biggest feature gap:**
Gap [2] — product asset uploads. The table and bucket are ready; only the UI and server action are missing.

**Biggest business gap:**
Gap [3] — user invites. Without this, you can't onboard a single real pilot user without going into Supabase.

---

*Last updated: 2026-06-14. Generated from live codebase at commit `800053c`.*
