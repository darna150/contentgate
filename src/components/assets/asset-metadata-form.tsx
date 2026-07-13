"use client";

import { useState, useTransition } from "react";
import { updateProductAssetMetadata } from "@/app/(app)/products/actions";
import { PRODUCT_ASSET_APPROVAL_STATUSES } from "@/lib/product-assets";
import { ASSET_STATUS_LABELS, type AssetItem } from "./types";

const FIELD_LABEL = "text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint";
const FIELD_INPUT =
  "rounded-control border border-edge bg-page px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

type Props = {
  asset: AssetItem;
  onSaved: () => void;
  onCancel: () => void;
};

export function AssetMetadataForm({ asset, onSaved, onCancel }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await updateProductAssetMetadata(asset.id, asset.productId, formData);
        setSaved(true);
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save changes.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <label className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>
          Title <span className="text-reject">*</span>
        </span>
        <input
          name="title"
          required
          maxLength={120}
          defaultValue={asset.title}
          className={FIELD_INPUT}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>Alt text</span>
        <input
          name="alt_text"
          maxLength={300}
          defaultValue={asset.altText ?? ""}
          placeholder="Describes the image for screen readers"
          className={FIELD_INPUT}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>Description</span>
        <textarea
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={asset.description ?? ""}
          className={`resize-none ${FIELD_INPUT}`}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>Tags</span>
        <input
          name="tags"
          defaultValue={asset.tags.join(", ")}
          placeholder="launch, social, hero"
          className={FIELD_INPUT}
        />
        <span className="text-[11.5px] text-ink-faint">
          Comma-separated. Saved in lowercase, up to 20 tags.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>Status</span>
        <select
          name="approval_status"
          defaultValue={asset.approvalStatus}
          className={FIELD_INPUT}
        >
          {PRODUCT_ASSET_APPROVAL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ASSET_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-control border border-reject-border bg-reject-tint px-3.5 py-2.5 text-[13px] text-reject"
        >
          {error}
        </p>
      )}
      {saved && !error && (
        <p
          role="status"
          className="rounded-control border border-approve-border bg-approve-tint px-3.5 py-2.5 text-[13px] text-approve"
        >
          Changes saved.
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-edge pt-3.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-control border border-edge-strong px-4 py-2.5 text-[13px] font-semibold text-ink-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
        >
          Close
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-control bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
