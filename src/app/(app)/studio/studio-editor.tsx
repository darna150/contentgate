"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CATEGORY_SIZES,
  SIZES,
  renderUrl,
  templatePreviewUrl,
  type SizeKey,
} from "@/lib/creative";
import { fieldLabel } from "@/lib/templates";
import { fieldLimitText, type FieldLimits } from "@/lib/template-fields";

type Product = { id: string; name: string };
type Template = {
  id: string;
  product_id: string;
  category: string;
  variant: string;
  editable_fields: string[];
  default_copy: Record<string, string>;
  field_limits: FieldLimits;
};

type Content = {
  id: string;
  title: string;
  status: string;
  structured_fields: Record<string, string>;
} | null;

const LANGUAGES = ["English", "Filipino", "Spanish", "Portuguese", "Vietnamese", "Thai"];

export function StudioEditor({
  products,
  templates,
  selectedProduct,
  selectedTemplate,
  initialContent,
  organizationName,
}: {
  products: Product[];
  templates: Template[];
  selectedProduct: Product;
  selectedTemplate: Template;
  initialContent: Content;
  organizationName: string;
}) {
  const router = useRouter();
  const sizes = CATEGORY_SIZES[selectedTemplate.category] ?? CATEGORY_SIZES.social;
  const [size, setSize] = useState<SizeKey>(sizes[0]);
  const [language, setLanguage] = useState("English");
  const [mode, setMode] = useState<"original" | "generated">(
    initialContent ? "generated" : "original"
  );
  const [content, setContent] = useState<Content>(initialContent);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productTemplates = useMemo(
    () => templates.filter((template) => template.product_id === selectedProduct.id),
    [templates, selectedProduct.id]
  );
  const activeFields =
    mode === "generated" && content
      ? content.structured_fields
      : selectedTemplate.default_copy;
  const previewUrl =
    mode === "generated" && content
      ? renderUrl(content.id, size)
      : templatePreviewUrl(selectedTemplate.id, size);
  const dims = SIZES[size];

  function navigate(productId: string, templateId?: string) {
    const firstTemplate =
      templateId ?? templates.find((template) => template.product_id === productId)?.id;
    const params = new URLSearchParams({ product: productId });
    if (firstTemplate) params.set("template", firstTemplate);
    router.push(`/studio?${params.toString()}`);
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/products/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productTemplateId: selectedTemplate.id,
          language,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Generation failed.");
        return;
      }
      const nextContent = {
        id: result.contentId as string,
        title: result.title as string,
        status: "draft",
        structured_fields: result.structured_fields as Record<string, string>,
      };
      setContent(nextContent);
      setMode("generated");
      router.replace(
        `/studio?product=${selectedProduct.id}&template=${selectedTemplate.id}&content=${nextContent.id}`,
        { scroll: false }
      );
    } catch {
      setError("Generation failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyText() {
    const text = selectedTemplate.editable_fields
      .map((key) => activeFields[key])
      .filter(Boolean)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function download() {
    setDownloading(true);
    try {
      const response = await fetch(previewUrl);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${selectedProduct.name}-${selectedTemplate.variant}-${mode}-${size}`
        .replace(/[^\w]+/g, "-")
        .toLowerCase()
        .concat(".png");
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("The preview could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-3 rounded-card border border-edge bg-surface p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-faint">
            Brand / client
          </span>
          <input
            value={organizationName}
            readOnly
            className="rounded-control border border-edge bg-page px-3 py-2.5 text-[13px] font-semibold text-ink-muted"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-faint">
            Product
          </span>
          <select
            value={selectedProduct.id}
            onChange={(event) => navigate(event.target.value)}
            className="rounded-control border border-edge-strong bg-surface px-3 py-2.5 text-[13px] font-semibold outline-none focus:border-brand"
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-faint">
            Template
          </span>
          <select
            value={selectedTemplate.id}
            onChange={(event) => navigate(selectedProduct.id, event.target.value)}
            className="rounded-control border border-edge-strong bg-surface px-3 py-2.5 text-[13px] font-semibold outline-none focus:border-brand"
          >
            {productTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.variant}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-[320px_1fr] items-start gap-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-5">
            <div className="grid grid-cols-2 rounded-control bg-page p-1">
              <button
                type="button"
                onClick={() => setMode("original")}
                className={`rounded-[7px] px-3 py-2 text-[12.5px] font-semibold ${
                  mode === "original" ? "bg-surface text-brand shadow-sm" : "text-ink-muted"
                }`}
              >
                Original
              </button>
              <button
                type="button"
                onClick={() => content && setMode("generated")}
                disabled={!content}
                className={`rounded-[7px] px-3 py-2 text-[12.5px] font-semibold disabled:opacity-40 ${
                  mode === "generated" ? "bg-surface text-brand shadow-sm" : "text-ink-muted"
                }`}
              >
                Generated
              </button>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-faint">
                Copy language
              </span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="rounded-control border border-edge-strong bg-surface px-3 py-2.5 text-[13px]"
              >
                {LANGUAGES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="rounded-control bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Generating fitted copy…" : content ? "Generate another variation" : "Generate replacement copy"}
            </button>
            {error && <p className="text-[12.5px] text-reject">{error}</p>}
          </div>

          <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-5">
            <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-faint">
              Text fields
            </span>
            {selectedTemplate.editable_fields.map((key) => (
              <div key={key} className="flex flex-col gap-0.5 border-b border-edge pb-2.5 last:border-0 last:pb-0">
                <span className="text-[11px] font-semibold text-ink-faint">
                  {fieldLabel(key)} · {fieldLimitText(selectedTemplate.field_limits[key])}
                </span>
                <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-ink">
                  {activeFields[key] || "—"}
                </p>
              </div>
            ))}
            <button
              type="button"
              onClick={copyText}
              className="rounded-control border border-edge-strong px-3 py-2 text-[12.5px] font-semibold"
            >
              {copied ? "Copied" : `Copy ${mode} copy`}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-card border border-edge bg-surface p-3">
            <span className="px-1 text-[12px] font-semibold text-ink-muted">Output size</span>
            {sizes.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSize(key)}
                className={`rounded-control border px-3 py-2 text-[12px] font-semibold ${
                  size === key ? "border-brand bg-brand-tint text-brand" : "border-edge"
                }`}
              >
                {SIZES[key].label}
              </button>
            ))}
            <div className="flex-1" />
            {content && mode === "generated" && (
              <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[10.5px] font-bold uppercase text-brand">
                {content.status}
              </span>
            )}
            <button
              type="button"
              onClick={download}
              disabled={downloading}
              className="rounded-control bg-brand-dark px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
            >
              {downloading ? "Preparing…" : "Download PNG"}
            </button>
          </div>

          <div className="flex min-h-[600px] items-center justify-center rounded-card border border-edge bg-page p-6">
            <div
              className="overflow-hidden rounded-[10px] bg-white shadow-xl"
              style={{
                width: dims.w >= dims.h ? "100%" : "auto",
                height: dims.w >= dims.h ? "auto" : "650px",
                maxWidth: "100%",
                aspectRatio: `${dims.w} / ${dims.h}`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={previewUrl} src={previewUrl} alt={`${mode} template preview`} className="h-full w-full object-contain" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
