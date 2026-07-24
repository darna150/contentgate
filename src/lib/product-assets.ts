export const PRODUCT_ASSET_TYPES = [
  "logo",
  "packshot",
  "background",
  "image",
  "video",
] as const;

export const PRODUCT_ASSET_APPROVAL_STATUSES = [
  "processing",
  "pending",
  "approved",
  "rejected",
  "archived",
] as const;

export type ProductAssetType = (typeof PRODUCT_ASSET_TYPES)[number];
export type ProductAssetApprovalStatus =
  (typeof PRODUCT_ASSET_APPROVAL_STATUSES)[number];
export type ProductAssetMediaKind = "image" | "video";

export const MAX_PRODUCT_IMAGE_ASSET_BYTES = 10 * 1024 * 1024;
export const MAX_PRODUCT_VIDEO_ASSET_BYTES = 100 * 1024 * 1024;
export const MAX_PRODUCT_ASSET_TAGS = 20;

const ALLOWED_PRODUCT_ASSET_MIME_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export function productAssetMediaKindForMimeType(mimeType: string): ProductAssetMediaKind | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

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
  productId: string | null,
  fileName: string,
  assetId = crypto.randomUUID()
) {
  return `${orgId}/${productId ?? "brand"}/${assetId}-${sanitizeProductAssetFileName(fileName)}`;
}

export function isProductAssetStoragePath(
  storagePath: string,
  orgId: string,
  productId: string | null
) {
  const parts = storagePath.split("/");
  const collectionKey = productId ?? "brand";
  return (
    parts.length === 3 &&
    parts[0] === orgId &&
    parts[1] === collectionKey &&
    parts[2].length > 0
  );
}

export function validateProductAssetFile(file: File) {
  if (file.size === 0) throw new Error("Choose an asset.");
  if (!ALLOWED_PRODUCT_ASSET_MIME_TYPES.has(file.type)) {
    throw new Error("Use a PNG, JPEG, WebP, GIF, AVIF, MP4, MOV, or WebM file.");
  }
  const mediaKind = productAssetMediaKindForMimeType(file.type);
  const maxBytes =
    mediaKind === "video" ? MAX_PRODUCT_VIDEO_ASSET_BYTES : MAX_PRODUCT_IMAGE_ASSET_BYTES;
  if (file.size > maxBytes) {
    throw new Error(
      mediaKind === "video"
        ? "Videos must be 100 MB or smaller."
        : "Images must be 10 MB or smaller."
    );
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
