# Template Onboarding Standard

Last updated: 2026-07-24

## Reference Pattern

The approved reference pattern is now a portable template bundle published through
the Template Platform. Figma remains the internal design source; ContentGate
clients see only approved template families, manifest-declared editable slots,
approved DAM assets, approvals, and exports.

## Required Inputs

- Product or brand workspace.
- Approved Figma reference frames.
- Locked artwork/background assets or exported locked frame backgrounds.
- Product images and logos.
- Product-specific fonts.
- Approved source documents and claims.
- Field list for editable copy.
- Optional approved image-slot list, DAM binding rules, and crop rules.
- Field limits and line limits.
- Export sizes.

## Implementation Checklist

1. Create a bundle directory with `manifest.json`, bundled fonts, full-reference
   images, clean generated backgrounds, and optional fixture payloads.
2. Give every client/template a stable manifest `family.key`, immutable
   `version`, and explicit `variants[]` with exact `width` and `height`.
3. Declare every text, background-choice, and asset-choice field in
   `manifest.fields`; field keys are the long-lived contract, not Figma layer
   names.
4. For DAM-backed image/video slots, add `assetBinding` metadata to the
   `asset_choice` field:
   - `source: "product_assets"`
   - `scope: "brand"`, `"product"`, or `"product_or_brand"`
   - optional `mediaKind`, `assetType`, `category`, and required tags.
5. Define exact text slots and image slots for every variant. Image slots should
   point to either a bundled manifest asset, a background choice field, or a
   manifest-declared asset-choice field.
6. Set bounded text contracts (`maxChars` or `maxWords`, `maxLines`, and
   `fit: "shrink_to_fit"` with `minFontSize` where needed).
7. Run bundle preflight before import; structural validation alone is not
   enough.
   - Preferred Phase 7 command:
     `npm run template-platform:onboard-client -- <bundle-dir> --output onboarding-report.md`
   - Use `--json` when the report needs to feed CI or an admin import tool.
8. Import with `POST /api/template-bundles/import`, then publish with
   `POST /api/template-bundles/publish`. Import and publish must stay atomic:
   failed assets or invalid manifests must not create partially usable versions.
9. Assign the published version to the product through an active platform
   assignment pinned to the immutable template version.
10. Upload brand/product assets into the Asset Library and approve them before
    expecting DAM-bound Studio pickers to show them.
11. Verify Studio shows only manifest-declared copy fields, background choices,
    and DAM pickers for the selected variant.
12. Verify generation preserves selected background and generic DAM asset choices
    during regenerate/adapt flows.
13. Add every new manifest pattern to automated preflight/render/stress tests.
14. Verify download/export remains blocked until approval.

## Manifest And DAM Binding Rules

- Do not add a new product-specific renderer for normal client refreshes.
- Do not hardcode client names, product asset paths, or picker values in Studio.
- Do not add product-template generation paths for new work; `productTemplateId`
  generation is retired and remains read-only for historical content only.
- Do not add demo evidence fallbacks. New clients must have approved claims or
  product documents before generation can run.
- Use manifest `assetBinding` to describe what Studio may offer from the mini-DAM.
- Studio may display only approved `product_assets` rows matching organization,
  product/brand scope, media kind, asset type, category, and tags.
- Render/export may sign only selected DAM asset ids that still match the
  manifest binding. A stale or mismatched selected id should fail closed by
  rendering no asset rather than signing an arbitrary approved asset.
- Keep bundled template artwork in `template-bundles`; keep client-changeable
  brand/product materials in `product-assets`.

## Required Test Gates

Before activating a new client template, run:

```bash
npm run typecheck
npm run test:templates
npm run test:ui
npm run build
```

For release branches, also run `npm test`. The TSX render suite may need the
normal local permission to create its IPC pipe.

## Phase 8 Observability

Template preflight, import, publish, and generation emit structured
`template_pipeline_event` logs with family/version/variant identifiers, issue
counts, asset counts, DAM-bound field counts, duration, and success/failure
status. Use those logs to spot slow imports, failing client bundles, missing
DAM setup, or generation attempts before client evidence is ready.

`/api/health` checks Supabase plus both `rendered-assets` and `template-bundles`
storage buckets because the platform path depends on both output delivery and
private template bundle reads.

## Activation Rule

A template should only become active when:

- It matches the approved reference design.
- It survives long-copy stress tests.
- Fonts render correctly in both server render and live browser canvas.
- DAM-bound image/video slots show approved matching assets in Studio and render
  selected assets in live preview, draft preview, and export.
- Draft/rejected content cannot be exported through direct URLs.
- The approved export path has been tested.
- The Figma frame IDs and exported locked assets match the registered sizes.
- Internal design provenance is not sent to client-facing Studio/workspace props.

## Claude Code Notes

Claude Code should handle visual calibration after the approved Figma frames exist. It should not loosen the template contract, backend approval, RLS, or export constraints to make a UI easier to demo, and it should not create new product-specific renderers for normal client template refreshes.
