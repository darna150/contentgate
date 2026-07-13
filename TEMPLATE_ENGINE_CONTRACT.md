# Template Engine Contract

Last updated: 2026-07-13

## Purpose

ContentGate templates are locked production layouts with controlled copy fields. The template engine separates four concerns:

1. The design source defines the approved visual reference.
2. The code renderer reproduces that reference for supported output sizes.
3. The template contract defines editable fields, limits, locked elements, layout presets, and overflow behavior.
4. The content workflow controls generation, review, approval, and export.

Changing the design source from Canva to Figma must not weaken or replace the content workflow.

## Source Of Truth

- Runtime contract registry: `src/lib/template-contract.ts`
- Shared active renderer dispatch: `src/lib/template-renderer.tsx`
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

All other existing templates remain inactive. Inactive historical templates stay readable for existing content but cannot become active until they are registered and pass the contract suite.

## Runtime Rules

- Studio, product workspaces, and generation use the same readiness check.
- Output-size controls come from the layout contract, not broad category defaults.
- Generation trims model output to the effective field limits.
- Save, review, approval, and export block invalid fields.
- Live-canvas overflow blocks save, review, and export.
- Server image rendering accepts only a declared template size.
- Only approved content can use the server export route.
- Canva/Figma links and identifiers are metadata and never grant export permission.

## Automated Verification

`npm test` covers:

- Contract registration for every active layout.
- Exact sizes, editable fields, field limits, and locked fields.
- Invalid engine/field/lock/size rejection.
- Equivalent Canva and Figma runtime behavior.
- Worst-case copy fitting for every editable field.
- Nonblank PNG rendering for every active layout and supported output size.

The normal lint, TypeScript, and production-build gates remain required.

## Figma Migration

When the replacement Figma templates are ready:

1. Create one canonical Figma component or frame set per ContentGate layout.
2. Create a named frame for each supported size in the registered size list.
3. Mark copy layers with stable field keys matching `editable_fields` exactly.
4. Keep logos, product imagery, backgrounds, typography, colors, icons, and legal elements locked.
5. Record the Figma file key, page ID, frame IDs, and design version under `template_definition.design_source`.
6. Export locked raster assets at the renderer's exact pixel dimensions.
7. Calibrate the existing renderer or add a registered replacement renderer without changing approval/export checks.
8. Run the full contract and render matrix, then compare outputs against the approved Figma frames.
9. Activate a replacement template only after the visual comparison and long-copy review pass.

Recommended Figma metadata shape:

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
