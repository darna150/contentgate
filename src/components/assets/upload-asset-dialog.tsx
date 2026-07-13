"use client";

import { useRef, useState, useTransition } from "react";
import { uploadProductAsset } from "@/app/(app)/products/actions";
import {
  PRODUCT_ASSET_TYPES,
  validateProductAssetFile,
  type ProductAssetType,
} from "@/lib/product-assets";
import { ASSET_TYPE_LABELS, type ProductOption } from "./types";
import { formatFileSize } from "./format";
import { Modal } from "./modal";
import { UploadIcon } from "./icons";

const FIELD_LABEL = "text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint";
const FIELD_INPUT =
  "rounded-control border border-edge bg-page px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

type Props = {
  products: ProductOption[];
  fixedProductId?: string;
  defaultAssetType?: ProductAssetType;
  onClose: () => void;
  onUploaded: () => void;
};

export function UploadAssetDialog({
  products,
  fixedProductId,
  defaultAssetType = "image",
  onClose,
  onUploaded,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fixedProduct = fixedProductId
    ? products.find((p) => p.id === fixedProductId)
    : undefined;

  function handleFiles(files: FileList | null) {
    const file = files?.[0] ?? null;
    setFileError(null);
    setSuccess(false);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    try {
      validateProductAssetFile(file);
      setSelectedFile(file);
    } catch (err) {
      setSelectedFile(null);
      setFileError(err instanceof Error ? err.message : "Choose a valid image.");
    }
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    const files = event.dataTransfer.files;
    if (fileInputRef.current) fileInputRef.current.files = files;
    handleFiles(files);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!selectedFile) {
      setFileError("Choose an image.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const productId = fixedProductId || String(formData.get("product_id") ?? "");
    if (!productId) {
      setError("Choose a product.");
      return;
    }
    startTransition(async () => {
      try {
        await uploadProductAsset(productId, formData);
        setSuccess(true);
        onUploaded();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  return (
    <Modal
      title="Upload asset"
      description="Approved uploads publish immediately. Only admins can upload."
      onClose={onClose}
      maxWidthClassName="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {!fixedProductId && (
          <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>
              Product <span className="text-reject">*</span>
            </span>
            <select name="product_id" required defaultValue="" className={FIELD_INPUT}>
              <option value="" disabled>
                Choose a product…
              </option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {fixedProduct && (
          <p className="text-[12.5px] text-ink-muted">
            Uploading to <span className="font-semibold text-ink">{fixedProduct.name}</span>
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>
            Asset type <span className="text-reject">*</span>
          </span>
          <select name="asset_type" defaultValue={defaultAssetType} className={FIELD_INPUT}>
            {PRODUCT_ASSET_TYPES.map((type) => (
              <option key={type} value={type}>
                {ASSET_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>
            Image <span className="text-reject">*</span>
          </span>
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-control border border-dashed px-4 py-6 text-center transition-colors ${
              dragOver ? "border-brand bg-brand-tint" : "border-edge-strong bg-page hover:border-brand"
            }`}
          >
            <UploadIcon className="h-5 w-5 text-ink-faint" />
            {selectedFile ? (
              <span className="flex flex-col items-center gap-0.5">
                <span className="max-w-[280px] truncate text-[13px] font-semibold text-ink">
                  {selectedFile.name}
                </span>
                <span className="text-[11.5px] text-ink-faint">
                  {formatFileSize(selectedFile.size)}
                </span>
              </span>
            ) : (
              <span className="text-[12.5px] text-ink-muted">
                Drag an image here, or click to choose a file
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              name="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              required
              className="sr-only"
              onChange={(event) => handleFiles(event.target.files)}
            />
          </label>
          <span className="text-[11.5px] text-ink-faint">
            PNG, JPEG, WebP, GIF, or AVIF. Maximum 10 MB.
          </span>
          {fileError && (
            <p role="alert" className="text-[12.5px] text-reject">
              {fileError}
            </p>
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>Title</span>
          <input
            name="title"
            maxLength={120}
            placeholder="Defaults to file name"
            className={FIELD_INPUT}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>Tags</span>
          <input
            name="tags"
            placeholder="launch, social, hero"
            className={FIELD_INPUT}
          />
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-control border border-reject-border bg-reject-tint px-3.5 py-2.5 text-[13px] text-reject"
          >
            {error}
          </p>
        )}
        {success && !error && (
          <p
            role="status"
            className="rounded-control border border-approve-border bg-approve-tint px-3.5 py-2.5 text-[13px] text-approve"
          >
            Uploaded. It is now live in the library.
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-edge pt-3.5">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-control border border-edge-strong px-4 py-2.5 text-[13px] font-semibold text-ink-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
          >
            {success ? "Close" : "Cancel"}
          </button>
          <button
            type="submit"
            disabled={pending || !!fileError || success}
            className="flex items-center gap-2 rounded-control bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Uploading…" : success ? "Uploaded" : "Upload asset"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
