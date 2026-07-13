# Template Engine Contract

Last updated: 2026-07-14

## Purpose

ContentGate templates are locked production layouts with controlled copy fields. The template engine separates four concerns:

1. The internal design source defines the approved visual reference.
2. A published template package converts that design into locked frames, editable slots, and export geometry.
3. The template contract defines editable fields, limits, locked elements, layout presets, and overflow behavior.
4. The content workflow controls generation, review, approval, and export.

Figma is an internal production layer, not a client-facing feature. Clients see only approved template sets and editable slots in ContentGate.

## Source Of Truth

- Runtime contract registry: `src/lib/template-contract.ts`
- Shared active renderer dispatch: `src/lib/template-renderer.tsx`
- Published package renderer: `src/lib/published-template-package.tsx`
- Database metadata: `product_templates.template_definition`
- Field fitting and validation: `src/lib/template-fields.ts` and `src/lib/template-specs.ts`
- Active render matrix: `src/lib/template-renderer.test.tsx`

An active template is generation-ready only when the database record passes the code contract. Unknown or drifted active layouts are hidden from Studio and product-workspace generation and are rejected by the generation API.

## Contract Version 1

Every active template must declare:

- `contract_version: 1`
- `engine: "react-image-v1"`
- A non-empty `sizes` array
- `layout_policy: "locked_adaptive_presets"`
- `layout_presets: ["short", "standard", "long"]`
- `overflow_policy: "block_save_review_and_export"`
- `design_source.provider`: `canva`, `figma`, or `legacy`
- Optional `published_package` data for imported locked frames and slot geometry
- The exact editable-field order registered for its layout
- Positive `max_chars` and `max_lines` limits for each editable field
- Every required locked field registered for its layout

The database enforces the common metadata. The code registry enforces layout-specific sizes, fields, and locks.

## Active Template Matrix

| Layout | Sizes | Editable fields |
| --- | --- | --- |
| `apex_canine_social` | Square, Story | Kicker, headline, support copy, CTA |
| `apex_canine_flyer` | A4 | Kicker, headline, body |
| `caniguard5_social` | Square | Headline, support copy |
| `vitalbite_social` | Square | Kicker, headline, supporting copy, CTA |
| `contentgate_local_friendly` | Square, Story, Link Ad, Leaderboard, Medium Rectangle | Headline, subheadline, local detail, CTA, proof note |
| `contentgate_local_premium` | Square, Portrait, Story, Link Ad, Medium Rectangle | Headline, subheadline, local detail, CTA, proof note |

All other existing templates remain inactive. Inactive historical templates stay readable for existing content but cannot become active until they are registered and pass the contract suite.

## Runtime Rules

- Studio, product workspaces, and generation use the same readiness check.
- Output-size controls come from the layout contract, not broad category defaults.
- Generation trims model output to the effective field limits.
- Save, review, approval, and export block invalid fields.
- Live-canvas overflow blocks save, review, and export.
- Server image rendering accepts only a declared template size.
- Only approved content can use the server export route.
- Canva/Figma links and identifiers are internal metadata and never grant export permission.
- Studio and product-workspace props must strip internal design provenance before reaching the browser.

## Automated Verification

`npm test` covers:

- Contract registration for every active layout.
- Exact sizes, editable fields, field limits, and locked fields.
- Invalid engine/field/lock/size rejection.
- Equivalent Canva and Figma runtime behavior.
- Worst-case copy fitting for every editable field.
- Nonblank PNG rendering for every active layout and supported output size.

The normal lint, TypeScript, and production-build gates remain required.

## Published Package Workflow

For client work, ContentGate should use published template packages rather than new product-specific renderers.

1. Design the client's approved template set internally in Figma.
2. Create a named frame for each supported ContentGate output size.
3. Mark editable copy and image areas with stable slot keys matching `editable_fields` or approved image-slot keys.
4. Keep layout, logos, typography, color, legal text, masks, and export geometry locked.
5. Publish a package into `template_definition.published_package` with frame dimensions, locked visual layers or exported locked backgrounds, text slots, image slots, and overflow rules.
6. Store Figma file keys, page IDs, and design versions only under internal `design_source` metadata.
7. Run the full contract and render matrix, then visually compare the ContentGate output against the approved Figma frames.
8. Activate the template only after visual comparison, long-copy review, Studio preview, and approved export all pass.

Recommended internal metadata shape:

```json
{
  "design_source": {
    "provider": "figma",
    "file_key": "...",
    "page_id": "...",
    "frame_ids": {
      "square": "...",
      "story": "..."
    },
    "version": "2026-08-01"
  }
}
```

Claude Code's later role is visual calibration against these approved Figma frames. It must not change template permissions, lifecycle rules, field limits, approval state transitions, or export authorization.
