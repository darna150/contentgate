# Phase 0 baseline evidence

Status: in progress

Last updated: 2026-07-28

## Scope and evidence boundary

This baseline uses the completed master-plan audit, current source inspection,
the checked-in design screenshots, and live captures at
`http://localhost:3001`. A dedicated confirmed QA administrator was provisioned
through the existing trusted provisioning handshake for the Nimbus demo
organization. Its credentials are retained only in the active QA session.

## Route matrix

| Route or surface | Current evidence | Baseline state | Follow-up |
| --- | --- | --- | --- |
| `/login` | Live desktop, tablet, and mobile capture | Clean responsive sign-in; governance message is visible | Recheck after global shell changes |
| `/dashboard` | Authenticated desktop capture | Activity is record-oriented; repeated Nimbus square drafts make one campaign appear duplicated | Group activity by campaign/session in Phase 1/3 |
| `/products` and workspace tabs | Source plus July audit | Product workspace is the right scope, but exposes `Templates` | Rename presentation language in Phase 1 |
| `/content` | Source plus July audit | Ledger has repeated generic draft labels and record-level grouping | Add campaign-aware labels/grouping in Phase 1/3 |
| `/approvals` | Source plus July audit | Reviewer entry lacks a compact change/evidence summary | Address in Phase 4 |
| `/assets` | Source plus July audit | Lifecycle/readiness signals need stronger asset metadata | Address in Phase 5 |
| `/ask` and `/knowledge` | Source plus July audit | `Source Documents` and knowledge terminology compete | Consolidate language in Phase 1/5 |
| `/templates` | Source plus July audit | Technical operator surface; preserve its terminology for admins | Keep isolated from client surfaces |
| `/settings` | Source inspection | Admin configuration surface | Preserve role-aware access |
| `/studio/new` and `/studio/[contentId]` | Authenticated desktop capture, source, July audit, and checked-in Studio reference | Fresh Nimbus Studio opens with selected product/campaign/format but a blank white preview area; controls compete and terminology leaks | Phase 2 after Phase 1 context and language |

## Live evidence

- `http://localhost:3001` redirects unauthenticated users to `/login`.
- The live sign-in screen was inspected at desktop (1280×720), tablet
  (768×1024), and mobile (390×844). Its split layout collapses without
  horizontal overflow, and fields and action remain visibly labeled.
- A dedicated QA administrator successfully signed in to the Nimbus demo
  workspace. The dashboard had no browser-console or failed-request errors.
- The authenticated dashboard visibly contains repeated `Nimbus 1 · Nimbus Air
  Campaign` activity rows for the same Instagram square format, confirming the
  campaign-grouping audit finding with live data.
- A fresh Studio capture confirms that its header currently says `Product &
  Variant`, its view is a blank white canvas before generation, and all nine
  refinements are equally exposed.

## Current component inventory

Reusable components already available:

- `PageHeader` for page title, description, and actions.
- `StatusPill` for lifecycle labels.
- `DashboardSummaryPanel` for attention, stats, and activity.
- `FilterChips`, `SizeChip`, and `FieldCounter` for filters, formats, and fit.
- `Sidebar` with a mobile focus-trapped drawer.
- Studio-specific field, preview, background-picker, toolbar, and review
  components.

One-off or inconsistent patterns found:

- Client-facing navigation still uses `Dashboard`, `Approvals`, and `Source
  Documents` rather than the recommended Home, Reviews, and Brand knowledge.
- Product workspace uses `Templates` where clients should see Campaigns.
- Studio and approval controls still present `Reject` / `Reject with note`.
- Studio uses `Reference` rather than Original design and includes an
  accessibility label containing `template variant`.
- Instrumentation currently consists of Vercel Analytics and Speed Insights;
  the safe, workflow-level event taxonomy from the measurement plan is not yet
  implemented.

## Provisional terminology decisions

| Existing client-visible term | Phase 1 presentation term |
| --- | --- |
| Dashboard | Home |
| Approvals | Reviews |
| Source Documents | Brand knowledge |
| Templates | Campaigns |
| Template variant | Format |
| Reference | Original design |
| Reject | Request changes |

Template Ops retains its technical terminology. Database and API names remain
unchanged.

## Primary journey map

```text
Home → Products → Product workspace → Campaign → Studio message
  → Visuals and formats → Review → Approved assets
```

The current source architecture supports this journey without backend contract
changes. Phase 1 will clarify the visible labels, scope path, return context,
and next action. Phase 2 will reorganize Studio around the journey.

## Initial measurements

No participant timings or confidence scores have been recorded. The Nimbus
pilot now has a privacy-safe, feature-flag-gated event path for Studio open,
format/picker selection, autosave, generation, review, and export. It accepts
only allowlisted scalar metadata and rejects sensitive properties. Baseline and
post-change comparisons still require the planned collection window; do not
make a performance claim from instrumentation availability alone.

## Phase 0 risks and remaining work

- Authenticated route and mutation evidence can now use the dedicated safe QA
  administrator. Avoid mutation-heavy browser checks until the relevant phase
  is implemented.
- Five moderated sessions require participants and are an external coordination
  dependency; this work cannot be simulated.
- The canonical terminology is implemented at client presentation boundaries;
  Template Ops, database, and API terms remain intentionally technical.
- The first safe implementation slice is Phase 1 shared context, terminology,
  navigation grouping, and status language. It has no database, RLS, storage,
  lifecycle, or rendering-contract change.
