# Template Onboarding Standard

Last updated: 2026-07-06

## Reference Pattern

Apex Canine is the approved reference implementation. Every new production product/template should follow the same pattern before it is activated in the UI.

## Required Inputs

- Product or brand workspace.
- Approved Canva/Figma reference design.
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
3. Add or update the product renderer in `src/lib`.
4. Define a `CONTRACTS` object for pixel-exact text zones.
5. Add adaptive density presets only when the approved design needs them.
6. Run `fitCopy()` or equivalent field fitting on every editable text field.
7. Set `overflow: hidden` only as a guard, not as a substitute for correct contracts.
8. Add `data-template-field` / stack markers for live overflow detection where the Studio uses live canvas.
9. Add `product_templates` metadata with:
   - `editable_fields`
   - `default_copy`
   - `field_limits`
   - `locked_fields`
   - `template_definition.layout_policy`
   - `template_definition.overflow_policy`
10. Keep inactive products hidden until the template has been rebuilt with this standard.
11. Add render/stress checks for worst-case copy.
12. Verify generated preview updates after regeneration.
13. Verify download/export is blocked until approval.

## Activation Rule

A template should only become active when:

- It matches the approved reference design.
- It survives long-copy stress tests.
- Fonts render correctly in both server render and live browser canvas.
- Draft/rejected content cannot be exported through direct URLs.
- The approved export path has been tested.

## Claude Code Notes

Claude Code should handle visual calibration after Codex has set the data contract and safety rules. It should not loosen backend approval, RLS, or export constraints to make a UI easier to demo.
