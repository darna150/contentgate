# Template Platform v1

ContentGate templates should be reusable product assets, not renderer branches. The v1 platform separates design, product assignment, generated copy, and rendered outputs so a new product template can be added without handwritten coordinates in application code.

## Target Flow

```mermaid
flowchart LR
  figma["Figma template set"] --> publisher["ContentGate Figma Publisher"]
  publisher --> bundle["Portable template bundle"]
  bundle --> validator["Validator and compiler"]
  validator --> version["Immutable template version"]
  version --> assignment["Product assignment"]
  assignment --> generate["Size-first generation"]
  generate --> render["Generic renderer"]
  render --> output["Preview, approval, export"]
```

## Bundle Contract

A template bundle is a folder with a `manifest.json`, bundled fonts, exported full-reference images, exported background-only images, and optional fixtures. The manifest schema is represented in [manifest.ts](</Users/debbiemelgarejo/Documents/Content Gate/contentgate/src/lib/template-platform/manifest.ts:1>).

Required principles:

- The bundle declares semantic fields such as `headline`, `cta`, or `hero_image`.
- Variants represent concrete sizes, like `square`, `story`, `leaderboard`, or `medium_rectangle`.
- Each variant declares only the slots visible in that size.
- Text slots reference a bundled font by key. No system font fallback is allowed at publication time.
- Original preview uses the full Figma reference export.
- Generated output uses the background-only export plus editable slots.
- The validator blocks missing assets, missing fonts, missing fields, invalid geometry, duplicate semantic keys, and unsupported schema versions.
- The publish-readiness gate blocks visually unsafe bundles before they can become `ready`.

Example bundle layout:

```text
contentgate-local-friendly-v1/
  manifest.json
  fonts/
    Inter-Regular.ttf
    Inter-SemiBold.ttf
    Inter-Bold.ttf
  variants/
    square/
      reference.png
      background.png
    story/
      reference.png
      background.png
  fixtures/
    default.json
    long-copy.json
```

## Database Model

The additive migration [template_platform_v1_foundation](</Users/debbiemelgarejo/Documents/Content Gate/contentgate/supabase/migrations/20260714183000_template_platform_v1_foundation.sql:1>) introduces:

- `template_families`: stable reusable template identities.
- `template_versions`: immutable published bundle snapshots.
- `template_variants`: one concrete size/channel per version.
- `template_assets`: background, reference, font, and image assets by hash.
- `product_template_assignments`: product-specific enablement, default payload, and generation profile.
- `template_import_runs`: validation/preflight history.
- `render_jobs`: deterministic render records with diagnostics and output paths.
- `generated_content.template_version_id` and `generated_content.template_variant_id`: pins approved work to the exact template used.

The old `product_templates.layout_key` path remains available during migration, but new templates should target this platform instead.

## Compiler Contract

The compiler in [compiler.ts](</Users/debbiemelgarejo/Documents/Content Gate/contentgate/src/lib/template-platform/compiler.ts:1>) validates a manifest and produces insert-ready rows for the v1 tables. It does not write to the database directly.

The compiler is responsible for:

- canonical `manifest_sha256` hashing;
- generated IDs for the family, version, variants, assets, and import run;
- `ready` template version rows only when validation has no errors;
- `field_keys` per variant from the slots actually visible in that size;
- variant-owned reference/background assets and version-owned font assets;
- safe storage paths under the importer-provided bundle prefix;
- a validation report that can be stored on both `template_versions` and `template_import_runs`.

The future admin/API import path should call the compiler first, upload assets to storage, then insert the returned rows in a transaction.

## Publish-Readiness Gate

Structural manifest validation is not enough. A bundle may be valid JSON and still produce broken client-facing layouts. The publish-readiness validator in [publish-readiness.ts](</Users/debbiemelgarejo/Documents/Content Gate/contentgate/src/lib/template-platform/publish-readiness.ts:1>) is the safety gate for new clients and templates.

A version cannot become `ready` unless it passes these checks:

- Figma-derived bundles include the source Figma file key.
- Every variant has a separate full-reference asset and clean generated-background asset.
- Reference/background assets are not the same key, path, or checksum.
- Reference/background assets declare usable dimensions at 1x, 2x, or 3x of the variant canvas.
- Reference/background assets declare image MIME types.
- Font definitions point to font assets, use real font file extensions, and match the bundled asset checksum.
- Every publishable variant exposes at least one editable slot.
- Text slots reference text-compatible fields and image slots reference image-compatible fields.
- Text slots declare bounded copy limits (`maxChars` or `maxWords`).
- Text slots can physically fit their declared `fontSize × lineHeight × maxLines`.
- `shrink_to_fit` text slots declare a positive `minFontSize`.

This is the piece that prevents adding a new client from becoming trial-and-error. A bad Figma export or unsafe slot geometry fails during import instead of surfacing later in Studio, approval, or export.

## Importer Contract

The importer in [importer.ts](</Users/debbiemelgarejo/Documents/Content Gate/contentgate/src/lib/template-platform/importer.ts:1>) wraps the compiler with the operational checks needed before persistence.

The importer is responsible for:

- reusing an existing `template_families.id` when the same `family_key` already exists;
- verifying every manifest asset has a supplied payload;
- hashing supplied asset bytes and rejecting checksum mismatches;
- uploading verified assets to the private `template-bundles` bucket;
- inserting the compiled rows only after all uploads succeed;
- recording failed import runs without creating template versions.

The importer uses an injected repository boundary. The production repository should implement the final insert as one transactional operation, either through a database RPC or server-side transaction-capable client. Tests use a fake repository so validation, upload ordering, and failure handling stay deterministic.

## Import API

The first admin import endpoint is `POST /api/template-bundles/import`.

Request shape:

```json
{
  "manifest": {},
  "storagePrefix": "template-bundles/contentgate-local-friendly/v1",
  "assets": [
    {
      "path": "variants/square/background.png",
      "contentType": "image/png",
      "dataBase64": "..."
    }
  ]
}
```

Only admins can call it. The route verifies the user, checks asset hashes through the importer, uploads files to `template-bundles`, persists the compiled rows through the Supabase repository, and returns the imported template version id plus variant ids.

Imported versions are left in `ready` status. An admin then publishes the immutable version with `POST /api/template-bundles/publish`:

```json
{
  "templateVersionId": "..."
}
```

After publishing, an admin can attach that version to a product with `POST /api/product-template-assignments`:

```json
{
  "productId": "...",
  "templateVersionId": "...",
  "defaultVariantKey": "square",
  "generationProfile": {},
  "defaultPayload": {}
}
```

The assignment endpoint validates that the product belongs to the current organization, the template version is published, and the default variant exists in the manifest.

## Local Bundle Preflight

Before a new client template is imported, run the same preflight locally against the exported bundle directory:

```bash
npm run template-platform:preflight-bundle -- ./path/to/client-template-v1
```

The bundle directory must contain `manifest.json` and every asset path declared in the manifest. Optional sample copy fixtures can be checked too:

```bash
npm run template-platform:preflight-bundle -- ./path/to/client-template-v1 \
  --sample ./path/to/client-template-v1/fixtures/default.json \
  --sample ./path/to/client-template-v1/fixtures/long-copy.json
```

This verifies:

- manifest structure;
- publish-readiness rules;
- asset files exist inside the bundle folder;
- asset checksums match the manifest;
- required sample fields are present;
- sample copy fits every declared variant.

Only bundles that pass local preflight should be imported, published, and assigned to products.

For local/demo setup, the ContentGate bundles can be installed with:

```bash
npm run template-platform:install-contentgate
```

If Supabase has not applied the Template Platform migrations yet, generate one paste-ready SQL file and run it in Supabase SQL Editor first:

```bash
npm run template-platform:write-migration-sql
```

This writes `.template-bundles/template-platform-migrations.sql`, combining:

- `supabase/migrations/20260714183000_template_platform_v1_foundation.sql`
- `supabase/migrations/20260714190000_template_bundle_storage.sql`

By default the script loads `.env.local`, resolves the first organization, finds the seeded `ContentGate` product, imports both ContentGate platform bundles if missing, publishes them, and upserts product assignments. Useful options:

```bash
npm run template-platform:install-contentgate -- --org-id <org-id>
npm run template-platform:install-contentgate -- --product-id <product-id>
npm run template-platform:install-contentgate -- --product-name "ContentGate"
npm run template-platform:install-contentgate -- --no-assign
npm run template-platform:install-contentgate -- --dry-run
```

## Version Lifecycle

Template versions move through:

```text
draft -> validating -> ready -> published -> retired
```

Published versions are immutable. A Figma update creates a new version, and product assignments promote or roll back explicitly. Existing generated content stays pinned to the version and variant it used.

## Size-First Generation

The user chooses the output size before generation. The app then prompts the model only for fields visible in that variant. This prevents one long payload from being forced into every unrelated canvas size.

The intended workflow is:

```text
Product -> Template -> Size -> Generate -> Edit -> Review -> Export
```

## Current ContentGate Font Policy

Current ContentGate template bundles use Inter. Future clients may bundle other approved fonts per template version, but the renderer must fail validation if a declared slot cannot be rendered with its bundled font.

## Implementation Phases

1. Foundation: ship schema, manifest types, validator, tests, and this contract.
2. Publisher: build the local Figma publisher that tags fields, exports full references, exports background-only images, and writes manifests.
3. Compiler: ingest a bundle into the new tables and fail publication on validation errors.
4. Renderer: render any bundle variant with the same engine, using bundled fonts and deterministic diagnostics.
5. ContentGate migration: import the two ContentGate families as real bundles using Inter and the existing Figma-derived backgrounds.
6. Studio/generation: switch generation to size-first and render/edit from manifest-defined fields.
7. Cleanup: retire `layout_key` renderer dispatch for migrated templates and remove legacy template-specific font dependencies.
