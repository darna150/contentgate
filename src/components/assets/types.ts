import type {
  ProductAssetApprovalStatus,
  ProductAssetType,
} from "@/lib/product-assets";

export type AssetItem = {
  id: string;
  productId: string;
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
};

export type ProductOption = { id: string; name: string; status: string };

export const ASSET_TYPE_LABELS: Record<ProductAssetType, string> = {
  logo: "Logo",
  packshot: "Packshot",
  background: "Background",
  image: "Supporting image",
};

export const ASSET_STATUS_LABELS: Record<ProductAssetApprovalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  archived: "Archived",
};
