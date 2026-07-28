# UI/UX audit findings

## Executive assessment

ContentGate has a credible premium B2B foundation: restrained visual language, one functional accent, clear lifecycle colors, source-backed claims, locked design rules, and meaningful role separation. The main usability issue is structural rather than decorative. The product exposes its system architecture more readily than the client's workflow.

Users must currently bridge products, templates, assignments, variants, content records, sources, reviews, and exports. A client naturally thinks in products, campaigns, messages, review, and final assets. The master plan closes that gap.

## What should be preserved

- Near-monochrome palette with teal as the single functional accent
- Border-first surfaces and restrained elevation
- Consistent status tones for draft, review, approved, rejected, warning, and destructive actions
- Product workspaces as a natural organizing model
- Locked-template and approved-asset constraints
- Evidence-backed generation and inspectable citations
- Role-aware author, approver, and admin capabilities
- Mobile drawer, focus trapping, semantic labels, error boundaries, and responsive content cards already present
- Technical density isolated to Template Ops

## Severity scale

- P0: blocks completion, causes data loss, or weakens governance
- P1: creates recurring confusion, delay, or mistrust in a core flow
- P2: increases cognitive effort or reduces discoverability
- P3: polish or optimization after the workflow is sound

## Cross-product findings

### P1 — Competing workspace and product scopes

The global sidebar and product tabs both represent navigation scope. Once a user enters Nimbus 1, the interface does not consistently reinforce whether an action is workspace-wide, product-scoped, campaign-scoped, or draft-scoped.

Recommendation: introduce a persistent context path and preserve the entry scope when navigating between Product, Studio, Content, Reviews, Assets, and Brand knowledge.

### P1 — Technical language leaks into client workflows

`Templates`, `template variants`, `generated content`, `Source Documents`, `Reference`, and related language describe implementation more than intent.

Recommendation: use Campaign, Format, Draft, Brand knowledge, and Original design for client-facing flows. Keep technical names in Template Ops and internal telemetry.

### P1 — Activity is record-oriented instead of campaign-oriented

The live dashboard showed multiple nearly identical Nimbus draft rows. This is technically accurate but cognitively noisy and makes routine testing or multi-format generation look like duplication.

Recommendation: group activity and content by campaign generation session, with drill-down to formats.

### P1 — Process states are visually too similar

Saving, preview asset loading, font readiness, AI generation, server rendering, and export preparation are separate operations. Users should never need to infer which one is happening.

Recommendation: establish a single state-language system with operation-specific labels and stable placement.

### P2 — Primary action hierarchy changes by screen without a shared rule

Some screens use a clear teal primary action; others use dark buttons, linked cards, or disabled export controls without a consistent next-step model.

Recommendation: define one dominant next action for every state and demote navigation or secondary actions.

### P2 — Small secondary text risks readability

Several surfaces use 11–12.5px labels and metadata. This is visually elegant but can become difficult at laptop distance, browser zoom, lower-quality displays, and for older users.

Recommendation: reserve 11px for uppercase eyebrows; use at least 13–14px for meaningful metadata and explanatory text.

## Route-by-route audit

### Dashboard

Strengths:

- Greeting and attention state are immediately understandable.
- Summary cards are clickable and status-aware.
- Empty review state is calm and useful.

Problems:

- Counts are more prominent than continuation.
- Recent activity becomes repetitive during multi-format generation.
- The dashboard does not clearly surface active campaign progress.

Recommendations:

- Lead with Continue where you left off.
- Group activity by campaign/session.
- Replace passive totals with actionable summaries.
- Add product/campaign readiness and review blockers when relevant.

### Products

Strengths:

- Product is the correct object for organizing brand context.
- Product status and workspace tabs establish ownership.

Problems:

- Initial-letter tiles do not scale when products share initials.
- Readiness is inferred across tabs rather than summarized.
- `Templates` describes platform structure rather than client intent.

Recommendations:

- Use approved product thumbnails with a neutral fallback.
- Add a readiness checklist: campaign, sources, artwork, and permissions.
- Rename Templates to Campaigns for non-operator roles.
- Reorder tabs to Overview, Campaigns, Content, Reviews, Assets, Brand knowledge.

### Content ledger

Strengths:

- Status and filtering are clear.
- Responsive cards avoid mobile horizontal scrolling.
- Lifecycle and export rule are described in the page header.

Problems:

- Repeated generic titles are difficult to distinguish.
- Formats are presented as independent content even when they belong to one campaign.
- Search is absent.
- Page-derived size filters may not expose formats absent from the current page.

Recommendations:

- Use generated headline or campaign title as the primary label.
- Group by campaign by default, with an individual-output view.
- Add search across title, product, campaign, and owner.
- Source filter values from assigned formats, not only current result rows.
- Restore filter and scroll state after returning from Studio.

### Approval Queue

Strengths:

- Urgency is reinforced through color, text, and age.
- Review is a clear row-level action.
- Product-scoped approval views exist.

Problems:

- `Blocked on you` may feel accusatory to clients.
- Reviewers enter Studio without an upfront change/evidence summary.
- Reject language can feel terminal.

Recommendations:

- Use Awaiting your review or Overdue by N days for client roles.
- Add change, evidence, compliance, and fit summaries.
- Replace Reject with Request changes.
- Require structured or written feedback when requesting changes.

### Studio

Strengths:

- Live copy limits and fit feedback protect the design.
- Product and background choices are explicit.
- Working preview and original design can be compared.
- Lifecycle and export gates are enforced.

Problems:

- The left panel exposes many categories at once.
- Product, background, refinement, size, language, copy, review, and export controls compete for attention.
- Product and background pickers previously appeared visually similar or empty.
- Large format inventories do not fit a flat selector model.
- Preview loading can feel blank or stalled even when technically correct.
- The difference between saving, preview updating, generating, and rendering is not always obvious.
- Manual edits, generated copy, and source evidence are not summarized in one place.

Recommendations: see the dedicated [Studio redesign specification](./03-STUDIO-REDESIGN-SPEC.md).

### Assets

Strengths:

- Collection rail matches the product organization model.
- Grid/list modes support visual and operational work.
- Upload is appropriately governed.

Problems:

- Asset readiness and technical suitability are not always obvious from the card.
- Transparent assets need explicit validation to prevent fake checkerboard files.
- Edit and delete actions can compete with preview.

Recommendations:

- Show approval/processing/failure, dimensions, type, alpha state, and usage count.
- Use a labeled checkerboard only inside asset previews for genuine transparency.
- Reject or warn on fully opaque product cutouts intended for transparent slots.
- Move secondary actions to an overflow menu.

### Brand knowledge and Ask

Strengths:

- Paragraph-addressable citations are a differentiating trust feature.
- Unsupported generation fails closed.
- Ask maintains product context and approved source links.

Problems:

- Source Documents, Knowledge, and Knowledge Hub sound like different systems.
- Upload, indexing, approval, and citable readiness are distinct states that need stronger differentiation.
- Ask confidence and product scope should be more persistent.

Recommendations:

- Use Brand knowledge as the umbrella, with Sources, Approved claims, and Ask.
- Show document lifecycle explicitly.
- Display active product scope, support status, and source count with each answer.
- Make unsupported answers stop before speculative prose is presented.

### Template Ops

Strengths:

- Technical density is appropriate for administrators.
- Import, preflight, publish, assignment, and rendering are visible operational states.

Problems:

- Operator terminology must not leak into client-facing surfaces.
- Complex sections need task-level hierarchy and progressive disclosure.

Recommendations:

- Keep Template Ops admin-only.
- Group by Import, Validate, Publish, Assign, Monitor.
- Provide clear remediation for failed preflight or storage integrity.
- Preserve detailed identifiers behind expandable diagnostics.

### Settings, login, and global states

Recommendations:

- Keep login simple and confidence-building; avoid marketing clutter.
- Standardize form success, pending, and error states.
- Provide specific local recovery before falling back to the global error page.
- Add a skip link and verify focus restoration after dialogs and navigation drawers.

## Behavioral-science interpretation

- Hick's Law: flat lists of refinements and formats increase decision time; group and progressively disclose.
- Recognition over recall: persistent selections, context paths, and save state reduce memory burden.
- Fitts's Law: primary actions and common picker targets should be large, stable, and reachable.
- Peak-end rule: generation completion and export are memorable moments; make them clear and reassuring.
- Error prevention: disable impossible actions with a visible reason before users attempt them.
- Cognitive offloading: campaign summaries should explain readiness, changes, evidence, and next action.
- Change blindness: keep the previous preview visible and identify what updated.
- Trust calibration: expose evidence and constraints without making the client understand backend mechanics.

## Top five recommendations

1. Reorganize Studio around Message, Visuals, Formats, and Review.
2. Preserve the preview during updates and separate save, generation, preview, and render language.
3. Group outputs and activity by campaign rather than individual database records.
4. Add persistent product/campaign/draft context throughout the app.
5. Use real picker thumbnails and validate transparent product assets before publication.
