# Template Onboarding Standard

Last updated: 2026-07-13

## Reference Pattern

Apex Canine is the approved reference implementation. Every new production product/template should follow the same pattern before it is activated in the UI.

## Required Inputs

- Product or brand workspace.
- Approved Figma reference frames. Canva may remain as legacy reference metadata during migration.
- Locked artwork/background assets.
- Product images and logos.
- Product-specific fonts.
- Approved source documents and claims.
- Field list for editable copy.
- Field limits and line limits.
- Export sizes.

## Implementation Checklist

1. Add product-specific font files under `public/fonts` when needed.
2. Declare the exact browser font families in `src/app/globals.css`.
3. Register the layout, exact output sizes, fields, locks, and renderer in `src/lib/template-contract.ts`.
4. Add or update the product renderer in `src/lib` and route it through `src/lib/template-renderer.tsx`.
5. Define a renderer `CONTRACTS` object for pixel-exact text zones.
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

## Claude Code Notes

Claude Code should handle visual calibration after the approved Figma frames exist. It should not loosen the template contract, backend approval, RLS, or export constraints to make a UI easier to demo.
