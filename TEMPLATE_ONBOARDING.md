# Template Onboarding Standard

Last updated: 2026-07-14

## Reference Pattern

The approved reference pattern is now a published template package. Figma remains the internal design source; ContentGate clients see only approved template sets, controlled editable slots, approvals, and exports.

## Required Inputs

- Product or brand workspace.
- Approved Figma reference frames.
- Locked artwork/background assets or exported locked frame backgrounds.
- Product images and logos.
- Product-specific fonts.
- Approved source documents and claims.
- Field list for editable copy.
- Optional approved image-slot list and crop rules.
- Field limits and line limits.
- Export sizes.

## Implementation Checklist

1. Add product-specific font files under `public/fonts` when needed.
2. Declare the exact browser font families in `src/app/globals.css`.
3. Register the layout, exact output sizes, fields, locks, and `published-design` renderer in `src/lib/template-contract.ts`.
4. Publish the template geometry through `template_definition.published_package` or add a temporary package registry entry in `src/lib/published-template-package.tsx`.
5. Define exact text slots and image slots for every output size.
6. Add short, standard, and long density presets only when the approved design needs them.
7. Run `fitCopy()` or equivalent field fitting on every editable text field.
8. Set `overflow: hidden` only as a guard, not as a substitute for correct contracts.
9. Add `data-template-field` / stack markers for live overflow detection where the Studio uses live canvas.
10. Add `product_templates` metadata with:
   - `editable_fields`
   - `default_copy`
   - `field_limits`
   - `locked_fields`
   - `template_definition.layout_policy`
   - `template_definition.overflow_policy`
   - `template_definition.contract_version`
   - `template_definition.engine`
   - `template_definition.sizes`
   - `template_definition.design_source`
   - `template_definition.published_package`
11. Keep templates inactive until the contract validator accepts them.
12. Add the layout and every output size to the automated render/stress matrix.
13. Verify generated preview updates after regeneration.
14. Verify download/export is blocked until approval.

## Activation Rule

A template should only become active when:

- It matches the approved reference design.
- It survives long-copy stress tests.
- Fonts render correctly in both server render and live browser canvas.
- Draft/rejected content cannot be exported through direct URLs.
- The approved export path has been tested.
- The Figma frame IDs and exported locked assets match the registered sizes.
- Internal design provenance is not sent to client-facing Studio/workspace props.

## Claude Code Notes

Claude Code should handle visual calibration after the approved Figma frames exist. It should not loosen the template contract, backend approval, RLS, or export constraints to make a UI easier to demo, and it should not create new product-specific renderers for normal client template refreshes.
