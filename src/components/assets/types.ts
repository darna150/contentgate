import type {
  ProductAssetApprovalStatus,
  ProductAssetMediaKind,
  ProductAssetType,
} from "@/lib/product-assets";

export type AssetItem = {
  id: string;
  productId: string | null;
  productName: string;
  assetType: ProductAssetType;
  title: string;
  description: string | null;
  altText: string | null;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  widthPixels: number | null;
  heightPixels: number | null;
  tags: string[];
  approvalStatus: ProductAssetApprovalStatus;
  createdAt: string;
  updatedAt: string;
  previewUrl: string;
  mediaKind: ProductAssetMediaKind;
  checksumSha256: string | null;
  durationSeconds: number | null;
  aspectRatio: number | null;
  posterStoragePath: string | null;
  category: string | null;
  downloadCount: number;
  lastDownloadedAt: string | null;
};

export type ProductOption = { id: string; name: string; status: string };

export const ASSET_TYPE_LABELS: Record<ProductAssetType, string> = {
  logo: "Logo",
  packshot: "Packshot",
  background: "Background",
  image: "Supporting image",
  video: "Video",
};

export const ASSET_STATUS_LABELS: Record<ProductAssetApprovalStatus, string> = {
  processing: "Processing",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  archived: "Archived",
};
