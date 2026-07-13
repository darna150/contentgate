export const PRODUCT_ASSET_TYPES = [
  "logo",
  "packshot",
  "background",
  "image",
] as const;

export const PRODUCT_ASSET_APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "archived",
] as const;

export type ProductAssetType = (typeof PRODUCT_ASSET_TYPES)[number];
export type ProductAssetApprovalStatus =
  (typeof PRODUCT_ASSET_APPROVAL_STATUSES)[number];

export const MAX_PRODUCT_ASSET_BYTES = 10 * 1024 * 1024;
export const MAX_PRODUCT_ASSET_TAGS = 20;

const ALLOWED_PRODUCT_ASSET_MIME_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isProductAssetType(value: string): value is ProductAssetType {
  return PRODUCT_ASSET_TYPES.includes(value as ProductAssetType);
}

export function isProductAssetApprovalStatus(
  value: string
): value is ProductAssetApprovalStatus {
  return PRODUCT_ASSET_APPROVAL_STATUSES.includes(
    value as ProductAssetApprovalStatus
  );
}

export function sanitizeProductAssetFileName(fileName: string) {
  const sanitized = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-+\./g, ".")
    .replace(/^[-.]+|[-.]+$/g, "")
    .toLowerCase();

  return sanitized || "asset";
}

export function defaultProductAssetTitle(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const title = withoutExtension
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return title || "Untitled asset";
}

export function parseProductAssetTags(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return [];

  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .map((tag) => tag.slice(0, 40))
    )
  ).slice(0, MAX_PRODUCT_ASSET_TAGS);
}

export function buildProductAssetStoragePath(
  orgId: string,
  productId: string,
  fileName: string,
  assetId = crypto.randomUUID()
) {
  return `${orgId}/${productId}/${assetId}-${sanitizeProductAssetFileName(fileName)}`;
}

export function isProductAssetStoragePath(
  storagePath: string,
  orgId: string,
  productId: string
) {
  const parts = storagePath.split("/");
  return (
    parts.length === 3 &&
    parts[0] === orgId &&
    parts[1] === productId &&
    parts[2].length > 0
  );
}

export function validateProductAssetFile(file: File) {
  if (file.size === 0) throw new Error("Choose an image.");
  if (!ALLOWED_PRODUCT_ASSET_MIME_TYPES.has(file.type)) {
    throw new Error("Use a PNG, JPEG, WebP, GIF, or AVIF image.");
  }
  if (file.size > MAX_PRODUCT_ASSET_BYTES) {
    throw new Error("Images must be 10 MB or smaller.");
  }
}

export function cleanProductAssetText(
  value: FormDataEntryValue | null,
  maxLength: number
) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}
