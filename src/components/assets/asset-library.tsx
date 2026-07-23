"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageOff } from "lucide-react";
import { assetLibraryFiltersToSearch, type AssetLibraryFilterState } from "@/lib/asset-library-filters";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { AssetItem, ProductOption } from "./types";
import { AssetFilterToolbar } from "./filter-toolbar";
import { AssetGrid } from "./asset-grid";
import { AssetList } from "./asset-list";
import { AssetPreviewDialog } from "./asset-preview-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AssetMetadataForm } from "./asset-metadata-form";
import { DeleteAssetDialog } from "./delete-asset-dialog";
import { UploadAssetDialog } from "./upload-asset-dialog";
import { UploadIcon } from "./icons";

type DialogState =
  | { type: "closed" }
  | { type: "preview"; asset: AssetItem }
  | { type: "edit"; asset: AssetItem }
  | { type: "delete"; asset: AssetItem }
  | { type: "upload" };

type Collection = { id: string; label: string; count: number };

type Props = {
  assets: AssetItem[];
  products: ProductOption[];
  collections: Collection[];
  filters: AssetLibraryFilterState;
  isAdmin: boolean;
};

export function AssetLibrary({ assets, products, collections, filters, isAdmin }: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ type: "closed" });
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const visibleAssets = useMemo(
    () => assets.filter((asset) => !deletedIds.has(asset.id)),
    [assets, deletedIds]
  );
  const uploadProducts = products.filter((product) => product.status === "active");

  const hasFilters = Boolean(
    filters.q || filters.product || filters.type || filters.status || filters.tag
  );

  function closeDialog() {
    setDialog({ type: "closed" });
  }

  function refresh() {
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Assets"
        description="Governed logos, packshots, backgrounds, and images across your products."
        actions={
          isAdmin ? (
            <Button
              onClick={() => setDialog({ type: "upload" })}
            >
              <UploadIcon className="h-4 w-4" /> Upload asset
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-5 md:flex-row">
        <nav aria-label="Collections" className="flex shrink-0 flex-row gap-1 overflow-x-auto md:w-56 md:flex-col md:overflow-visible">
          {collections.map((collection) => {
            const active = filters.product === collection.id;
            const href = `?${assetLibraryFiltersToSearch({ ...filters, product: collection.id }).replace(/^\?/, "")}`;
            return (
              <Link
                key={collection.id || "all"}
                href={href || "?"}
                className={`flex shrink-0 items-center justify-between gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors md:rounded-control ${
                  active ? "bg-brand-dark text-white" : "text-ink-muted hover:bg-page hover:text-ink"
                }`}
              >
                <span className="truncate">{collection.label}</span>
                <span
                  className={`rounded-full px-[7px] py-px text-[11px] font-bold ${
                    active ? "bg-white/15 text-white" : "bg-page text-ink-faint"
                  }`}
                >
                  {collection.count}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <AssetFilterToolbar filters={filters} resultCount={visibleAssets.length} />

          {visibleAssets.length === 0 ? (
            <EmptyState
              icon={ImageOff}
              title={hasFilters ? "No assets match these filters" : "No assets yet"}
              description={
                hasFilters
                  ? "Try a different search or reset filters to see the full library."
                  : isAdmin
                    ? "Upload your first logo, packshot, background, or image to get started."
                    : "Assets will appear here once an admin uploads them."
              }
            />
          ) : filters.view === "list" ? (
            <AssetList
              assets={visibleAssets}
              isAdmin={isAdmin}
              onPreview={(asset) => setDialog({ type: "preview", asset })}
              onEdit={(asset) => setDialog({ type: "edit", asset })}
              onDelete={(asset) => setDialog({ type: "delete", asset })}
            />
          ) : (
            <AssetGrid
              assets={visibleAssets}
              isAdmin={isAdmin}
              onPreview={(asset) => setDialog({ type: "preview", asset })}
              onEdit={(asset) => setDialog({ type: "edit", asset })}
              onDelete={(asset) => setDialog({ type: "delete", asset })}
            />
          )}
        </div>
      </div>

      {dialog.type === "preview" && (
        <AssetPreviewDialog
          asset={dialog.asset}
          isAdmin={isAdmin}
          onClose={closeDialog}
          onEdit={() => setDialog({ type: "edit", asset: dialog.asset })}
          onDelete={() => setDialog({ type: "delete", asset: dialog.asset })}
        />
      )}

      {dialog.type === "edit" && (
        <Dialog open onOpenChange={(next) => !next && closeDialog()}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit asset metadata</DialogTitle>
            </DialogHeader>
            <AssetMetadataForm asset={dialog.asset} onCancel={closeDialog} onSaved={refresh} />
          </DialogContent>
        </Dialog>
      )}

      {dialog.type === "delete" && (
        <DeleteAssetDialog
          asset={dialog.asset}
          onClose={closeDialog}
          onDeleted={() => {
            setDeletedIds((prev) => new Set(prev).add(dialog.asset.id));
            closeDialog();
            refresh();
          }}
        />
      )}

      {dialog.type === "upload" && (
        <UploadAssetDialog products={uploadProducts} onClose={closeDialog} onUploaded={refresh} />
      )}
    </div>
  );
}
