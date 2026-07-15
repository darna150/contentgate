"use client";

import { useRouter } from "next/navigation";
import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import {
  draftPreviewUrl,
  knownSizeDimensions,
  renderUrl,
  sizeLabel,
  templatePreviewUrl,
  type SizeKey,
} from "@/lib/creative";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import { renderTemplateBundleVariant } from "@/lib/template-platform/render";
import {
  getTemplateBundleSupportedSizes,
  getTemplateBundleVariantDimensions,
  getTemplateBundleVariantLabel,
} from "@/lib/template-platform/runtime";
import { fieldLabel, REVISION_OPTIONS } from "@/lib/templates";
import {
  fieldIssues,
  fieldLimitText,
  type FieldLimits,
} from "@/lib/template-fields";
import {
  checkDraftStructuredFieldsFit,
  submitForReview,
  updateStructuredFields,
} from "../content/actions";
import {
  GenerationLoader,
  LiveCanvasFrame,
  ServerPreviewFrame,
} from "./studio-preview";

type Product = { id: string; name: string; disclaimer_text: string | null };
type Template = {
  id: string;
  product_id: string;
  category: string;
  variant: string;
  layout_key: string;
  platformAssignmentId?: string;
  platformAssetUrlByPath?: Record<string, string>;
  platformManifest?: TemplateBundleManifest;
  editable_fields: string[];
  default_copy: Record<string, string>;
  field_limits: FieldLimits;
  locked_fields: string[];
  template_definition: Record<string, unknown>;
};

type Content = {
  id: string;
  title: string;
  status: string;
  structured_fields: Record<string, string>;
  outputSize: SizeKey | null;
  manuallyEdited: boolean;
  canEdit: boolean;
} | null;
type GeneratedContent = NonNullable<Content>;
type ExportFormat = "png" | "jpeg" | "pdf";

const LANGUAGES = ["English", "Filipino", "Spanish", "Portuguese", "Vietnamese", "Thai"];

function generatedContentSizeKey(
  content: GeneratedContent | null,
  fallback: SizeKey,
  supportedSizes: readonly SizeKey[]
) {
  if (content?.outputSize && supportedSizes.includes(content.outputSize)) {
    return content.outputSize;
  }
  return fallback;
}

function formatRetryWait(seconds: number) {
  const safeSeconds = Math.max(1, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return minutes > 0
    ? `${minutes}m${remainder > 0 ? ` ${remainder}s` : ""}`
    : `${remainder}s`;
}

function retryAfterSecondsFromPayload(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "retryAfterSeconds" in payload &&
    typeof payload.retryAfterSeconds === "number"
  ) {
    return Math.max(1, payload.retryAfterSeconds);
  }
  return null;
}

async function downloadUrl(url: string, filename: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Download failed.");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function renderPlatformCanvas(input: {
  manifest: TemplateBundleManifest;
  assetUrlByPath?: Record<string, string>;
  sizeKey: SizeKey;
  fields: Record<string, string>;
  original: boolean;
}): ReactElement {
  const rendered = renderTemplateBundleVariant({
    manifest: input.manifest,
    variantKey: input.sizeKey,
    fields: input.fields,
    assetUrlByPath: input.assetUrlByPath,
    original: input.original,
  });
  if (!rendered) {
    throw new Error(`No platform template variant for ${input.sizeKey}.`);
  }
  return rendered.element;
}

export function StudioEditor({
  products,
  templates,
  selectedProduct,
  selectedTemplate,
  initialContents,
  initialSize,
  organizationName,
}: {
  products: Product[];
  templates: Template[];
  selectedProduct: Product;
  selectedTemplate: Template;
  initialContents: GeneratedContent[];
  initialSize: SizeKey | null;
  organizationName: string;
}) {
  const router = useRouter();
  const sizes = useMemo(
    () =>
      selectedTemplate.platformManifest
        ? getTemplateBundleSupportedSizes(selectedTemplate.platformManifest)
        : [],
    [selectedTemplate.platformManifest]
  );
  const [size, setSize] = useState<SizeKey>(
    initialSize && sizes.includes(initialSize) ? initialSize : sizes[0]
  );
  const initialContentsBySize = useMemo(() => {
    const entries: Partial<Record<SizeKey, GeneratedContent>> = {};
    for (const item of initialContents) {
      const itemSize = generatedContentSizeKey(item, sizes[0], sizes);
      if (!entries[itemSize]) entries[itemSize] = item;
    }
    return entries;
  }, [initialContents, sizes]);
  const initialContent = initialContentsBySize[size] ?? initialContents[0] ?? null;
  const [language, setLanguage] = useState("English");
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null);
  const [mode, setMode] = useState<"original" | "generated">(
    initialContent ? "generated" : "original"
  );
  const [contentsBySize, setContentsBySize] = useState<
    Partial<Record<SizeKey, GeneratedContent>>
  >(() => initialContentsBySize);
  const content = contentsBySize[size] ?? null;
  const hasAnyGeneratedDraft = Object.keys(contentsBySize).length > 0;
  const [hasManualEdits, setHasManualEdits] = useState(
    initialContent?.manuallyEdited ?? false
  );
  const [draftFields, setDraftFields] = useState<Record<string, string>>(
    initialContent?.structured_fields ?? selectedTemplate.default_copy
  );
  const [savedFields, setSavedFields] = useState<Record<string, string>>(
    initialContent?.structured_fields ?? selectedTemplate.default_copy
  );
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryUntil, setRetryUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [saveState, setSaveState] = useState<
    "idle" | "unsaved" | "saving" | "saved" | "error"
  >("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [overflowFields, setOverflowFields] = useState<string[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const saveSequence = useRef(0);
  const retrySecondsRemaining = retryUntil
    ? Math.max(0, Math.ceil((retryUntil - now) / 1000))
    : 0;
  const generationPaused = retrySecondsRemaining > 0;

  const productTemplates = useMemo(
    () => templates.filter((template) => template.product_id === selectedProduct.id),
    [templates, selectedProduct.id]
  );
  const showingGeneratedDraft = mode === "generated" && content !== null;
  const activeFields = showingGeneratedDraft
    ? draftFields
    : selectedTemplate.default_copy;
  const activeFieldLimits = selectedTemplate.field_limits;

  const editablePilot =
    mode === "generated" &&
    showingGeneratedDraft &&
    content !== null &&
    content.canEdit &&
    (content.status === "draft" || content.status === "rejected");
  const issuesByField = useMemo(
    () =>
      Object.fromEntries(
        selectedTemplate.editable_fields.map((key) => [
          key,
          fieldIssues(draftFields[key], activeFieldLimits[key]),
        ])
      ),
    [
      activeFieldLimits,
      draftFields,
      selectedTemplate.editable_fields,
    ]
  );
  const hasIssues = selectedTemplate.editable_fields.some(
    (key) => issuesByField[key].length > 0
  );
  const hasLayoutOverflow = overflowFields.length > 0;
  const dirty =
    mode === "generated" &&
    showingGeneratedDraft &&
    content !== null &&
    selectedTemplate.editable_fields.some(
      (key) => (draftFields[key] ?? "") !== (savedFields[key] ?? "")
    );
  const generatedExportAllowed =
    mode !== "generated" ||
    (!!content &&
      showingGeneratedDraft &&
      content.status === "approved" &&
      !dirty &&
      !hasIssues &&
      !hasLayoutOverflow &&
      saveState !== "saving");
  const dims =
    (selectedTemplate.platformManifest
      ? getTemplateBundleVariantDimensions(selectedTemplate.platformManifest, size)
      : null) ??
    knownSizeDimensions(size) ?? { w: 1080, h: 1080 };
  const activeSizeLabel = selectedTemplate.platformManifest
    ? getTemplateBundleVariantLabel(selectedTemplate.platformManifest, size)
    : sizeLabel(size);
  const liveCanvas = mode === "original" && selectedTemplate.platformManifest
    ? renderPlatformCanvas({
        manifest: selectedTemplate.platformManifest,
        assetUrlByPath: selectedTemplate.platformAssetUrlByPath,
        sizeKey: size,
        fields: activeFields,
        original: mode === "original",
      })
    : null;
  const generatedPreviewUrl =
    showingGeneratedDraft && content
      ? draftPreviewUrl(content.id, size, savedAt ?? content.id)
      : null;
  const serverPreviewUpdating =
    mode === "generated" &&
    showingGeneratedDraft &&
    (dirty || saveState === "unsaved" || saveState === "saving");

  function confirmDiscardUnsavedChanges() {
    if (!dirty) return true;
    return window.confirm(
      "You have unsaved copy edits. Discard them and continue?"
    );
  }

  useEffect(() => {
    let cancelled = false;
    let timer: number;
    if (!content || mode !== "generated" || !showingGeneratedDraft) {
      timer = window.setTimeout(() => {
        if (!cancelled) setOverflowFields([]);
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }
    if (hasIssues) {
      timer = window.setTimeout(() => {
        if (!cancelled) setOverflowFields([]);
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    const snapshot = { ...draftFields };
    timer = window.setTimeout(async () => {
      const result = await checkDraftStructuredFieldsFit(content.id, snapshot);
      if (cancelled) return;
      if ("error" in result) {
        setOverflowFields(["layout"]);
        return;
      }
      setOverflowFields(result.overflowFields);
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    content,
    draftFields,
    hasIssues,
    mode,
    showingGeneratedDraft,
    size,
  ]);

  useEffect(() => {
    if (!retryUntil) return;
    const timer = window.setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);
      if (nextNow >= retryUntil) {
        setRetryUntil(null);
        window.clearInterval(timer);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryUntil]);

  useEffect(() => {
    if (!dirty || !content || mode !== "generated") {
      return;
    }
    if (hasIssues || hasLayoutOverflow) {
      return;
    }

    const snapshot = { ...draftFields };
    const sequence = ++saveSequence.current;
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      const result = await updateStructuredFields(content.id, snapshot);
      if (sequence !== saveSequence.current) return;
      if ("error" in result) {
        setSaveState("error");
        setError(result.error);
        return;
      }
      setSavedFields(snapshot);
      setSavedAt(result.savedAt ?? new Date().toISOString());
      setSaveState("saved");
      setHasManualEdits(result.manuallyEdited ?? false);
      setError(null);
      setContentsBySize((current) => {
        const existing = current[size];
        if (!existing || existing.id !== content.id) return current;
        return {
          ...current,
          [size]: {
            ...existing,
            status: result.status ?? existing.status,
            structured_fields: snapshot,
            manuallyEdited: result.manuallyEdited ?? false,
          },
        };
      });
    }, 750);

    return () => window.clearTimeout(timer);
  }, [
    content,
    dirty,
    draftFields,
    hasIssues,
    hasLayoutOverflow,
    mode,
    size,
  ]);

  function switchMode(nextMode: "original" | "generated") {
    if (nextMode !== mode && !confirmDiscardUnsavedChanges()) return;
    if (nextMode === "generated" && !hasAnyGeneratedDraft) return;
    const nextContent = contentsBySize[size] ?? null;
    const nextFields =
      nextMode === "generated" && nextContent
        ? nextContent.structured_fields
        : selectedTemplate.default_copy;
    setMode(nextMode);
    setDraftFields(nextFields);
    setSavedFields(nextFields);
    setHasManualEdits(
      nextMode === "generated" && nextContent ? nextContent.manuallyEdited : false
    );
    setSaveState("idle");
    setSavedAt(null);
  }

  function selectSize(nextSize: SizeKey) {
    if (nextSize !== size && !confirmDiscardUnsavedChanges()) return;
    const nextContent = contentsBySize[nextSize] ?? null;
    const nextFields =
      mode === "generated" && nextContent
        ? nextContent.structured_fields
        : selectedTemplate.default_copy;
    setSize(nextSize);
    setDraftFields(nextFields);
    setSavedFields(nextFields);
    setHasManualEdits(
      mode === "generated" && nextContent ? nextContent.manuallyEdited : false
    );
    setError(null);
    setCopied(false);
    setOverflowFields([]);
    setSaveState("idle");
    setSavedAt(null);
  }

  function updateField(key: string, value: string) {
    const nextFields = { ...draftFields, [key]: value };
    const nextDirty = selectedTemplate.editable_fields.some(
      (field) => (nextFields[field] ?? "") !== (savedFields[field] ?? "")
    );
    setSaveState(nextDirty ? "unsaved" : "saved");
    setHasManualEdits(nextDirty ? true : (content?.manuallyEdited ?? false));
    setDraftFields(nextFields);
  }

  function navigate(productId: string, templateId?: string) {
    if (!confirmDiscardUnsavedChanges()) return;
    const firstTemplate =
      templateId ?? templates.find((template) => template.product_id === productId)?.id;
    const params = new URLSearchParams({ product: productId });
    if (firstTemplate) params.set("template", firstTemplate);
    router.push(`/studio?${params.toString()}`);
  }

  async function generate() {
    if (generationPaused) return;
    if (dirty && !confirmDiscardUnsavedChanges()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/products/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformAssignmentId: selectedTemplate.platformAssignmentId,
          language,
          outputSize: size,
          revisions: selectedRevision ? [selectedRevision] : [],
          replaceContentId:
            showingGeneratedDraft &&
            content &&
            (content.status === "draft" || content.status === "rejected")
              ? content.id
              : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        const retryAfterSeconds = retryAfterSecondsFromPayload(result);
        if (retryAfterSeconds) {
          setRetryUntil(Date.now() + retryAfterSeconds * 1000);
        }
        setError(result.error ?? "Generation failed.");
        return;
      }
      setRetryUntil(null);
      const nextContent = {
        id: result.contentId as string,
        title: result.title as string,
        status: "draft",
        structured_fields: result.structured_fields as Record<string, string>,
        outputSize: (result.outputSize as SizeKey | null) ?? size,
        manuallyEdited: false,
        canEdit: true,
      };
      const nextContentSize = nextContent.outputSize ?? size;
      setContentsBySize((current) => ({
        ...current,
        [nextContentSize]: nextContent,
      }));
      setMode("generated");
      setSize(nextContentSize);
      setDraftFields(nextContent.structured_fields);
      setSavedFields(nextContent.structured_fields);
      setSaveState("saved");
      setSavedAt(new Date().toISOString());
      setHasManualEdits(false);
      setSelectedRevision(null);
      router.replace(
        `/studio?product=${selectedProduct.id}&template=${selectedTemplate.id}&content=${nextContent.id}&size=${nextContentSize}`,
        { scroll: false }
      );
    } catch {
      setError("Generation failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyText() {
    setError(null);
    try {
      if (mode === "generated") {
        if (!content || !showingGeneratedDraft || !generatedExportAllowed) {
          throw new Error("Generated copy must be approved before export.");
        }
        const response = await fetch(`/api/export/${content.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            format: "clipboard_text",
            surface: "studio",
            size,
          }),
        });
        if (!response.ok) throw new Error("Export could not be recorded.");
      }
      const text = selectedTemplate.editable_fields
        .map((key) => activeFields[key])
        .filter(Boolean)
        .join("\n\n");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setError(
        message === "Generated copy must be approved before export."
          ? message
          : "Copy could not be copied. Check your browser permissions and try again."
      );
    }
  }

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      if (mode === "generated") {
        if (!content || !showingGeneratedDraft || !generatedExportAllowed) {
          throw new Error("Generated content must be approved before export.");
        }
        const response = await fetch(`/api/export/${content.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            format: exportFormat,
            surface: "studio",
            size,
          }),
        });
        if (!response.ok) throw new Error("Export could not be recorded.");
        const serverRenderUrl = new URL(renderUrl(content.id, size), window.location.origin);
        serverRenderUrl.searchParams.set("format", exportFormat);
        serverRenderUrl.searchParams.set("download", "1");
        const filename = `${selectedProduct.name}-${selectedTemplate.variant}-generated-${size}`
          .replace(/[^\w]+/g, "-")
          .toLowerCase();
        await downloadUrl(
          serverRenderUrl.toString(),
          `${filename}.${exportFormat === "jpeg" ? "jpg" : exportFormat}`
        );
        return;
      }
      const filename = `${selectedProduct.name}-${selectedTemplate.variant}-${mode}-${size}`
        .replace(/[^\w]+/g, "-")
        .toLowerCase();
      const serverPreviewUrl = new URL(
        templatePreviewUrl(selectedTemplate.id, size),
        window.location.origin
      );
      serverPreviewUrl.searchParams.set("format", exportFormat);
      serverPreviewUrl.searchParams.set("download", "1");
      await downloadUrl(
        serverPreviewUrl.toString(),
        `${filename}.${exportFormat === "jpeg" ? "jpg" : exportFormat}`
      );
    } catch {
      setError("The preview could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  async function submit() {
    if (
      !content ||
      !showingGeneratedDraft ||
      dirty ||
      hasIssues ||
      hasLayoutOverflow ||
      saveState === "saving"
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await submitForReview(content.id);
    if ("error" in result) {
      setError(result.error);
    } else {
      setContentsBySize((current) => {
        const existing = current[size];
        if (!existing || existing.id !== content.id) return current;
        return {
          ...current,
          [size]: { ...existing, status: "in_review" },
        };
      });
      router.refresh();
    }
    setSubmitting(false);
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

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-5">
            <div className="grid grid-cols-2 rounded-control bg-page p-1">
              <button
                type="button"
                onClick={() => switchMode("original")}
                className={`rounded-[7px] px-3 py-2 text-[12.5px] font-semibold ${
                  mode === "original" ? "bg-surface text-brand shadow-sm" : "text-ink-muted"
                }`}
              >
                Original
              </button>
              <button
                type="button"
                onClick={() => switchMode("generated")}
                disabled={!hasAnyGeneratedDraft}
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
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-faint">
                  Refinement suggestion
                </span>
                {selectedRevision && (
                  <button
                    type="button"
                    onClick={() => setSelectedRevision(null)}
                    disabled={busy}
                    className="text-[11px] font-semibold text-ink-faint hover:text-brand disabled:opacity-50"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {REVISION_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() =>
                      setSelectedRevision((current) =>
                        current === option.key ? null : option.key
                      )
                    }
                    disabled={busy}
                    aria-pressed={selectedRevision === option.key}
                    title={option.instruction}
                    className={`rounded-full border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors disabled:opacity-50 ${
                      selectedRevision === option.key
                        ? "border-brand bg-brand-tint text-brand"
                        : "border-edge-strong bg-surface text-ink-muted hover:border-brand hover:text-brand"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-ink-faint">
                Optional. Choose one direction before generating or refining the
                current draft.
              </p>
            </div>
            <button
              type="button"
              onClick={generate}
              disabled={busy || generationPaused}
              className="rounded-control bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-50"
            >
              {generationPaused
                ? `Try again in ${formatRetryWait(retrySecondsRemaining)}`
                : busy
                ? "Generating preview…"
                : showingGeneratedDraft &&
                    content &&
                    (content.status === "draft" ||
                      content.status === "rejected")
                  ? selectedRevision
                    ? "Apply refinement to draft"
                    : "Regenerate draft"
                  : selectedRevision
                    ? `Generate ${activeSizeLabel} with refinement`
                    : `Generate ${activeSizeLabel} draft`}
            </button>
            {error && <p className="text-[12.5px] text-reject">{error}</p>}
          </div>

          <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-5">
            <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-faint">
              Text fields
            </span>
            {selectedTemplate.editable_fields.map((key) => (
              <label
                key={key}
                className="flex flex-col gap-1.5 border-b border-edge pb-3 last:border-0 last:pb-0"
              >
                <span className="text-[11px] font-semibold text-ink-faint">
                  {fieldLabel(key)} · {fieldLimitText(activeFieldLimits[key])}
                </span>
                {editablePilot ? (
                  <textarea
                    value={activeFields[key] ?? ""}
                    onChange={(event) => updateField(key, event.target.value)}
                    rows={Math.min(
                      5,
                      Math.max(1, activeFieldLimits[key]?.max_lines ?? 2)
                    )}
                    className={`resize-none rounded-control border bg-surface px-3 py-2 text-[12.5px] leading-relaxed outline-none transition-colors ${
                      issuesByField[key].length || overflowFields.includes(key)
                        ? "border-reject focus:border-reject"
                        : "border-edge-strong focus:border-brand"
                    }`}
                  />
                ) : (
                  <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-ink">
                    {activeFields[key] || "—"}
                  </p>
                )}
                {editablePilot && (
                  <span
                    className={`text-[10.5px] font-semibold ${
                      issuesByField[key].length || overflowFields.includes(key)
                        ? "text-reject"
                        : "text-approve"
                    }`}
                  >
                    {issuesByField[key].length
                      ? issuesByField[key].map((issue) => issue.message).join(" · ")
                      : overflowFields.includes(key)
                        ? "Text does not fit this locked design"
                      : "✓ Fits template"}
                  </span>
                )}
              </label>
            ))}
            {editablePilot && (
              <p className="rounded-control bg-approve-tint px-3 py-2 text-[11.5px] leading-relaxed text-approve">
                Edits update the locked design immediately. Copy updates stay
                inside the selected output size. Artwork,
                typography, safe zones, and approved positions remain locked.
              </p>
            )}
            {mode === "original" && (
              <p className="rounded-control bg-page px-3 py-2 text-[11.5px] leading-relaxed text-ink-muted">
                Generate a variation to edit copy. The approved original remains
                read-only.
              </p>
            )}
            {mode === "generated" && !showingGeneratedDraft && (
              <p className="rounded-control bg-page px-3 py-2 text-[11.5px] leading-relaxed text-ink-muted">
                No generated draft exists for{" "}
                <span className="font-bold">{activeSizeLabel}</span> yet.
                Pick this size, then generate when you need it.
              </p>
            )}
            {mode === "generated" && content && (
              <div className="flex items-center justify-between rounded-control border border-edge bg-page px-3 py-2">
                <span
                  className={`text-[11.5px] font-semibold ${
                    saveState === "error"
                      ? "text-reject"
                      : saveState === "saved"
                        ? "text-approve"
                        : "text-ink-muted"
                  }`}
                >
                  {hasIssues
                    ? "Fix field limits to save"
                    : hasLayoutOverflow
                      ? "Shorten copy to fit the locked design"
                    : saveState === "saving"
                      ? "Saving…"
                      : saveState === "unsaved"
                        ? "Unsaved changes"
                        : saveState === "saved"
                          ? "✓ Draft saved"
                          : saveState === "error"
                            ? "Save failed"
                            : "Draft synced"}
                </span>
                {savedAt && (
                  <span className="text-[10.5px] text-ink-faint">
                    {new Date(savedAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            )}
            {mode === "generated" && content && hasManualEdits && (
              <p className="rounded-control border border-warn/20 bg-amber-50 px-3 py-2 text-[11.5px] leading-relaxed text-warn">
                Manual edits are tracked separately from the generated copy and
                require reviewer approval before export.
              </p>
            )}
            {mode === "generated" &&
              content &&
              content.canEdit &&
              (content.status === "draft" || content.status === "rejected") && (
                <button
                  type="button"
                  onClick={submit}
                  disabled={
                    submitting ||
                    dirty ||
                    hasIssues ||
                    hasLayoutOverflow ||
                    saveState === "saving" ||
                    saveState === "error"
                  }
                  className="rounded-control bg-brand-dark px-3 py-2.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit for review"}
                </button>
              )}
            {mode === "generated" && content?.status === "in_review" && (
              <p className="rounded-control bg-brand-tint px-3 py-2 text-[11.5px] font-semibold text-brand">
                Submitted for review. Editing is paused until it is approved or
                returned.
              </p>
            )}
            {mode === "generated" && content?.status === "approved" && (
              <p className="rounded-control bg-approve-tint px-3 py-2 text-[11.5px] font-semibold text-approve">
                Approved snapshot. Download is enabled.
              </p>
            )}
            <button
              type="button"
              onClick={copyText}
              disabled={mode === "generated" && !generatedExportAllowed}
              title={
                mode === "generated" && !generatedExportAllowed
                  ? "Generated copy can be copied after approval"
                  : undefined
              }
              className="rounded-control border border-edge-strong px-3 py-2 text-[12.5px] font-semibold disabled:opacity-50"
            >
              {copied ? "Copied" : `Copy ${mode} copy`}
            </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 rounded-card border border-edge bg-surface p-3">
            <span className="px-1 text-[12px] font-semibold text-ink-muted">
              Output size
            </span>
            {sizes.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => selectSize(key)}
                className={`rounded-control border px-3 py-2 text-[12px] font-semibold ${
                  size === key ? "border-brand bg-brand-tint text-brand" : "border-edge"
                }`}
              >
                {selectedTemplate.platformManifest
                  ? getTemplateBundleVariantLabel(selectedTemplate.platformManifest, key)
                  : sizeLabel(key)}
              </button>
            ))}
            <div className="hidden flex-1 xl:block" />
            {mode === "generated" && (
              <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[10.5px] font-bold uppercase text-brand">
                {showingGeneratedDraft && content
                  ? `${content.status} · ${activeSizeLabel}`
                  : `not generated · ${activeSizeLabel}`}
              </span>
            )}
            <select
                value={exportFormat}
                onChange={(event) =>
                  setExportFormat(event.target.value as ExportFormat)
                }
                aria-label="Download format"
                className="rounded-control border border-edge-strong bg-surface px-3 py-2 text-[12px] font-semibold"
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="pdf">PDF</option>
              </select>
            <button
              type="button"
              onClick={download}
              disabled={downloading || !generatedExportAllowed}
              title={
                mode === "generated" && !generatedExportAllowed
                  ? "Generated assets can be downloaded after approval"
                  : undefined
              }
              className="rounded-control bg-brand-dark px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
            >
              {downloading
                ? "Preparing…"
                : `Download ${exportFormat.toUpperCase()}`}
            </button>
          </div>

          <div className="relative">
            {busy && <GenerationLoader />}
            {mode === "generated" && generatedPreviewUrl ? (
              <ServerPreviewFrame
                src={generatedPreviewUrl}
                width={dims.w}
                height={dims.h}
                updating={serverPreviewUpdating}
              />
            ) : liveCanvas ? (
              <LiveCanvasFrame
                canvas={liveCanvas}
                canvasRef={canvasRef}
                width={dims.w}
                height={dims.h}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
