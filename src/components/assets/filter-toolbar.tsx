"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  assetLibraryFiltersToSearch,
  hasActiveAssetFilters,
  type AssetLibraryFilterState,
} from "@/lib/asset-library-filters";
import { PRODUCT_ASSET_APPROVAL_STATUSES, PRODUCT_ASSET_TYPES } from "@/lib/product-assets";
import { ASSET_STATUS_LABELS, ASSET_TYPE_LABELS, type ProductOption } from "./types";
import { GridIcon, ListIcon, SearchIcon, XIcon } from "./icons";

type Props = {
  filters: AssetLibraryFilterState;
  products: ProductOption[];
  resultCount: number;
};

const SELECT_LABEL = "w-full min-w-0 sm:w-auto";
const SELECT_CLASS =
  "w-full min-w-0 rounded-control border border-edge bg-page px-3 py-2 text-[12.5px] text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 sm:w-auto";

export function AssetFilterToolbar({ filters, products, resultCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchInput, setSearchInput] = useState(filters.q);
  const [syncedQ, setSyncedQ] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filtersRef = useRef(filters);

  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    setSearchInput(filters.q);
  }

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function updateFilters(patch: Partial<AssetLibraryFilterState>) {
    const next: AssetLibraryFilterState = { ...filtersRef.current, ...patch };
    filtersRef.current = next;
    router.replace(`${pathname}${assetLibraryFiltersToSearch(next)}`, { scroll: false });
  }

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateFilters({ q: value }), 350);
  }

  const active = hasActiveAssetFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative w-full min-w-0 flex-1 sm:w-auto sm:min-w-[200px]">
        <span className="sr-only">Search assets by title</span>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
        <input
          value={searchInput}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by title…"
          className="w-full rounded-control border border-edge bg-page py-2 pl-8 pr-3 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </label>

      <label className={SELECT_LABEL}>
        <span className="sr-only">Filter by product</span>
        <select
          value={filters.product}
          onChange={(event) => updateFilters({ product: event.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">All products</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </label>

      <label className={SELECT_LABEL}>
        <span className="sr-only">Filter by asset type</span>
        <select
          value={filters.type}
          onChange={(event) =>
            updateFilters({ type: event.target.value as AssetLibraryFilterState["type"] })
          }
          className={SELECT_CLASS}
        >
          <option value="">All types</option>
          {PRODUCT_ASSET_TYPES.map((type) => (
            <option key={type} value={type}>
              {ASSET_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>

      <label className={SELECT_LABEL}>
        <span className="sr-only">Filter by approval status</span>
        <select
          value={filters.status}
          onChange={(event) =>
            updateFilters({ status: event.target.value as AssetLibraryFilterState["status"] })
          }
          className={SELECT_CLASS}
        >
          <option value="">All statuses</option>
          {PRODUCT_ASSET_APPROVAL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ASSET_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>

      <label className="w-full min-w-0 sm:w-auto">
        <span className="sr-only">Filter by tag</span>
        <input
          key={filters.tag}
          defaultValue={filters.tag}
          onBlur={(event) => updateFilters({ tag: event.target.value.trim().toLowerCase() })}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              (event.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Tag…"
          className="w-full min-w-0 rounded-control border border-edge bg-page px-3 py-2 text-[12.5px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 sm:w-[110px]"
        />
      </label>

      {active && (
        <button
          type="button"
          onClick={() => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            updateFilters({ q: "", product: "", type: "", status: "", tag: "" });
          }}
          className="flex items-center gap-1 rounded-control border border-edge-strong px-3 py-2 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-brand hover:text-brand"
        >
          <XIcon className="h-3 w-3" /> Reset
        </button>
      )}

      <div className="ml-auto flex items-center gap-2.5">
        <span className="text-[12px] text-ink-faint">
          {resultCount} {resultCount === 1 ? "asset" : "assets"}
        </span>
        <div role="group" aria-label="View mode" className="flex items-center rounded-control border border-edge bg-page p-0.5">
          <button
            type="button"
            aria-pressed={filters.view === "grid"}
            title="Grid view"
            onClick={() => updateFilters({ view: "grid" })}
            className={`flex h-7 w-7 items-center justify-center rounded-[6px] transition-colors ${
              filters.view === "grid" ? "bg-surface text-brand shadow-sm" : "text-ink-faint hover:text-ink"
            }`}
          >
            <GridIcon className="h-3.5 w-3.5" />
            <span className="sr-only">Grid view</span>
          </button>
          <button
            type="button"
            aria-pressed={filters.view === "list"}
            title="List view"
            onClick={() => updateFilters({ view: "list" })}
            className={`flex h-7 w-7 items-center justify-center rounded-[6px] transition-colors ${
              filters.view === "list" ? "bg-surface text-brand shadow-sm" : "text-ink-faint hover:text-ink"
            }`}
          >
            <ListIcon className="h-3.5 w-3.5" />
            <span className="sr-only">List view</span>
          </button>
        </div>
      </div>
    </div>
  );
}
