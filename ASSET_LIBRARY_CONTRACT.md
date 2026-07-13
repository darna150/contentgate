# Asset Library Contract

Last updated: 2026-07-13

## Scope

The MVP Asset Library is the governed source of product-level brand images. It
is not a campaign planner, freeform design tool, or generic cloud drive.

## Data Contract

`product_assets` remains organization- and product-scoped. The library adds:

- `title` (required), `description`, and `alt_text`.
- `original_file_name`, `mime_type`, and `file_size_bytes`.
- Nullable `width_pixels` and `height_pixels`, populated from verified image bytes on new uploads.
- Normalized `tags` as a text array.
- `approval_status`: `pending`, `approved`, `rejected`, or `archived`.
- `uploaded_by`, `created_at`, and trigger-maintained `updated_at`.

Asset categories remain `logo`, `packshot`, `background`, and `image` for the
MVP. New uploads default to `approved` because upload is admin-only.

## Storage Contract

- Bucket: `product-assets`.
- Path: `{org_id}/{product_id}/{uuid}-{safe-file-name}`.
- Accepted files: PNG, JPEG, WebP, GIF, and AVIF, up to 10 MB.
- Uploads are inspected with `sharp`; unreadable image bytes are rejected.
- The bucket remains public so existing product and Studio images continue to render.
- Public object listing is disabled. Discovery must use the RLS-protected `product_assets` table.
- Only authenticated admins may inspect, insert, or delete objects in their organization folder.
- Scoped admin object visibility is required by the Storage API to resolve deletes; public bucket listing remains blocked.
- Object replacement is intentionally unsupported in the MVP. Upload a new version instead.

## Server Contract

Asset mutations live in `src/app/(app)/products/actions.ts`:

- `uploadProductAsset(productId, formData)` verifies active product ownership, file content, metadata, and storage path; then writes an audit event.
- `updateProductAssetMetadata(assetId, productId, formData)` edits governed metadata and status inside the current organization; then writes an audit event.
- `deleteProductAsset(assetId, productId)` validates the stored path, removes the object through the Storage API, deletes the row, and writes an audit event.

Reusable validation and storage-path rules live in `src/lib/product-assets.ts`.
The future library UI should query through `listProductAssets` in
`src/lib/product-assets-server.ts`, which supports product, type, status, tag,
and title filters and returns preview URLs.

## Permission Contract

- Signed-in organization members may read asset metadata.
- Only admins may insert, update, or delete asset metadata.
- New rows must set `uploaded_by` to the current user.
- Asset table and storage writes are protected independently by RLS.
- Service-role access stays server-only and is used for audit writes, not ordinary asset mutations.

## Claude Code UI Handoff

Claude Code may build the `/assets` interface and improve the product asset
panel using this contract. The UI should include grid/list views, title search,
product/type/status/tag filters, previews, metadata editing, upload progress,
and clear empty/error/permission states.

Do not change the storage path, public-listing rule, RLS policies, service-role
boundary, accepted file rules, or audit behavior without returning the backend
change to Codex for review.
