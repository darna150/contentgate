import {
  isProductAssetApprovalStatus,
  isProductAssetType,
  type ProductAssetApprovalStatus,
  type ProductAssetType,
} from "@/lib/product-assets";

export type AssetLibraryView = "grid" | "list";

export type AssetLibraryFilterState = {
  q: string;
  product: string;
  type: ProductAssetType | "";
  status: ProductAssetApprovalStatus | "";
  tag: string;
  view: AssetLibraryView;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseAssetLibrarySearchParams(
  raw: RawSearchParams
): AssetLibraryFilterState {
  const q = firstValue(raw.q).trim().slice(0, 100);
  const product = firstValue(raw.product).trim();
  const typeRaw = firstValue(raw.type).trim();
  const statusRaw = firstValue(raw.status).trim();
  const tag = firstValue(raw.tag).trim().slice(0, 40).toLowerCase();
  const viewRaw = firstValue(raw.view).trim();

  return {
    q,
    product,
    type: isProductAssetType(typeRaw) ? typeRaw : "",
    status: isProductAssetApprovalStatus(statusRaw) ? statusRaw : "",
    tag,
    view: viewRaw === "list" ? "list" : "grid",
  };
}

export function assetLibraryFiltersToSearch(
  filters: Partial<AssetLibraryFilterState>
): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.product) params.set("product", filters.product);
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.view && filters.view !== "grid") params.set("view", filters.view);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function hasActiveAssetFilters(filters: AssetLibraryFilterState): boolean {
  return Boolean(filters.q || filters.product || filters.type || filters.status || filters.tag);
}
