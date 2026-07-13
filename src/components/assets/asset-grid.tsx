"use client";

import { AssetCard } from "./asset-card";
import type { AssetItem } from "./types";

type Props = {
  assets: AssetItem[];
  isAdmin: boolean;
  showProduct?: boolean;
  onPreview: (asset: AssetItem) => void;
  onEdit: (asset: AssetItem) => void;
  onDelete: (asset: AssetItem) => void;
};

export function AssetGrid({ assets, isAdmin, showProduct, onPreview, onEdit, onDelete }: Props) {
  return (
    <div className="@container">
      <div className="grid grid-cols-2 gap-3.5 @sm:grid-cols-3 @lg:grid-cols-4 @4xl:grid-cols-5">
        {assets.map((asset) => (
          <AssetCard
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
    </div>
  );
}
