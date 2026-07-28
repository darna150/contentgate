# New-session handoff

## Repository context

- Repository: `/Users/debbiemelgarejo/Documents/Content Gate/contentgate`
- Branch at handoff: `codex/fix-redesign-v2-flow`
- Observed HEAD at handoff: `bd0e82f Align asset E2E with signed download flow`
- Local app URL: `http://localhost:3001`
- Nimbus product ID: `27cf3a56-84e6-41fb-8cb7-4bf7dbe3c564`
- Active Nimbus assignment observed during testing: `6433194b-789e-4ca6-afd4-79a42ae54d7e`
- Active Nimbus template version published during the preceding work: `figma-full-v7`

Recheck these values before using them. They describe the handoff state, not permanent identifiers.

## Critical worktree warning

The worktree was intentionally dirty when this handoff was written. It contains prior work across security review, migrations, template import and publishing, evidence lifecycle, Studio performance, server rendering, Nimbus source assets, analytics, and transparent product variants.

Before editing:

1. Run `git status --short`.
2. Treat every existing modification and untracked file as user-owned.
3. Do not reset, clean, stash, overwrite, or bulk-format unrelated files.
4. Inspect overlapping files before patching.
5. Use `apply_patch` for edits.
6. Browser-test relevant flows before committing or pushing.

## Product invariants

- Nimbus Air / Nimbus 1 is the active demonstration direction.
- Nimbus sources are fictional test data.
- Selected output sizes must use their exact Figma reference layouts.
- Draft generation may change copy only.
- Do not move, resize, crop, restyle, or replace locked artwork as an overflow fix.
- Asset choices may change only through explicit approved product/background pickers.
- No silent fallback to default copy after generation failure.
- Claims must be grounded in approved sources.
- `Add proof point` may succeed only when approved evidence supports it.
- Preserve reviewer approval and export gates.

## Recent validated fixes relevant to the redesign

- Studio initially signs only assets needed by the active render instead of the entire bundle.
- Size switching preloads required render assets.
- Preview font loading is cached and limited to fonts used by the current variant.
- The old preview stays hidden behind an explicit `Loading locked preview…` state until correct fonts are ready.
- Old content records are not sent as generation sources when their template version differs from the active assignment.
- The generation response now returns the database's exact `updated_at` timestamp for optimistic locking.
- Studio uses that timestamp for its first post-generation autosave.
- Alternate Nimbus shoe assets were replaced with real-alpha PNGs.
- Nimbus `figma-full-v7` was published and assigned to Nimbus 1.

## Latest regression evidence observed before this handoff

- `npm run lint` passed.
- `npm test` passed (209 tests at that time).
- `npm run build` passed.
- Browser test: fresh generation succeeded.
- Browser test: all four product variants were selectable.
- Browser test: Volt Lime rendered without a fake checkerboard rectangle.
- Browser test: the post-generation picker conflict was not reproduced after the exact timestamp fix.

Rerun the appropriate checks after any implementation because the repository may have changed after this document was created.

## Required first actions for the next session

1. Read this entire package.
2. Inspect `git status`, branch, recent commits, and running dev server.
3. Open the live app and capture a baseline for desktop, tablet, and mobile.
4. Confirm the first execution phase with the user before implementing.
5. Update the execution checklist as work completes; do not silently skip acceptance gates.

## Recommended first implementation slice

Start with Phase 1 from the roadmap:

- Canonical terminology
- Persistent context path
- Primary-action hierarchy
- Dashboard/activity grouping design
- Standard save/loading/error language

Do not start with decorative polish. The information architecture and state model must be stable before visual refinement.

## Copy-paste prompt for a new Codex session

```text
We are implementing the ContentGate UI/UX Master Plan in:
/Users/debbiemelgarejo/Documents/Content Gate/contentgate

Start by reading every file in:
docs/ui-ux-master-plan/

Then inspect git status and preserve all existing dirty-worktree changes. Do not reset or clean anything. Follow the product invariants in 00-NEW-SESSION-HANDOFF.md. Before editing, audit the current live UI at localhost:3001 and compare it to the master plan. Execute only the next incomplete roadmap phase, keep its checklist current, run proportional tests, and browser-test the complete user flow before committing or pushing. Do not alter locked Figma layout, typography, artwork, crop, scale, or coordinates to solve copy fit or loading problems.
```

## Decision protocol

For each material design decision, record:

- Problem being solved
- User group affected
- Current evidence
- Proposed behavior
- Alternatives considered
- Accessibility impact
- Performance impact
- Backend or data-contract impact
- Acceptance criteria
- Final decision and owner

If a proposed UI simplification weakens governance, stop and escalate rather than hiding the rule.
