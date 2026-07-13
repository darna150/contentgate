"use client";

import { AssetRow } from "./asset-row";
import type { AssetItem } from "./types";

type Props = {
  assets: AssetItem[];
  isAdmin: boolean;
  showProduct?: boolean;
  onPreview: (asset: AssetItem) => void;
  onEdit: (asset: AssetItem) => void;
  onDelete: (asset: AssetItem) => void;
};

const HEADER_GRID =
  "md:grid-cols-[44px_minmax(0,1.6fr)_minmax(0,1fr)_100px_110px_minmax(0,1fr)_90px_auto]";

export function AssetList({ assets, isAdmin, showProduct, onPreview, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-hidden rounded-card border border-edge bg-surface">
      <div
        className={`hidden border-b border-edge bg-page px-3 py-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-faint md:grid md:gap-3 ${HEADER_GRID}`}
      >
        <span />
        <span>Asset</span>
        <span>Product</span>
        <span>Type</span>
        <span>Status</span>
        <span>File</span>
        <span>Updated</span>
        <span className="text-right">Actions</span>
      </div>
      {assets.map((asset) => (
        <AssetRow
          key={asset.id}
          asset={asset}
          isAdmin={isAdmin}
          showProduct={showProduct}
          onPreview={() => onPreview(asset)}
          onEdit={() => onEdit(asset)}
          onDelete={() => onDelete(asset)}
        />
      ))}
    </div>
  );
}
