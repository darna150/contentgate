"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  draftPreviewUrl,
  knownSizeDimensions,
  platformTemplatePreviewUrl,
  renderUrl,
  sizeLabel,
  studioContentUrl,
  templatePreviewUrl,
} from "@/lib/creative";
import { studioEditableTemplateFields } from "@/lib/generation-evidence";
import {
  BACKGROUND_CHOICE_FIELD,
  getTemplateBundleVariantAssetChoiceFields,
  getTemplateBundleVariantBackgroundOptions,
  getTemplateBundleVariantFieldLimits,
  getTemplateBundleVariantFields,
  getTemplateBundleSupportedSizes,
  getTemplateBundleVariantDimensions,
  getTemplateBundleVariantLabel,
} from "@/lib/template-platform/runtime";
import type { TemplateBundleTextLayout } from "@/lib/template-platform/render";
import { fieldIssues } from "@/lib/template-fields";
import {
  checkDraftStructuredFieldsFit,
  submitForReview,
  updateStructuredFields,
} from "../content/actions";
import {
  GenerationLoader,
  LiveTemplatePreviewFrame,
  MissingDraftFrame,
  ServerPreviewFrame,
} from "./studio-preview";
import { StudioBackgroundPicker } from "./studio-background-picker";
import { StudioFields } from "./studio-fields";
import { StudioGeneratePanel } from "./studio-generate-panel";
import { resolveStudioMode } from "./studio-mode";
import { StudioReviewActions } from "./studio-review-actions";
import { StudioExportBar, type ExportFormat, type ExportScale } from "./studio-toolbar";
import { StudioVersions } from "./studio-versions";
import type {
  StudioContent,
  StudioProduct,
  StudioTemplate,
} from "./studio-data";

function generatedContentSizeKey(
  content: StudioContent | null,
  fallback: string,
  supportedSizes: readonly string[]
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

const PRODUCT_VARIANT_FIELD = "__productVariantKey";

function StudioAssetChoicePicker({
  fieldKey,
  label,
  options,
  value,
  editable,
  onChange,
}: {
  fieldKey: string;
  label: string;
  options: Array<{ key: string; label: string; previewUrl?: string }>;
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
}) {
  if (!options.length) return null;
  return (
    <div className="flex flex-col gap-4 border-t border-edge pt-6">
      <div>
        <span className="text-label text-ink-faint">{label}</span>
        <p className="mt-2 text-[14px] leading-6 text-ink-muted">
          Select an approved asset for this locked image slot. Layout, scale,
          crop, and export rules remain controlled by the template.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const selected = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              disabled={!editable}
              onClick={() => editable && onChange(option.key)}
              aria-label={`${label}: ${option.label}`}
              className={`flex items-center gap-3 rounded-[10px] border px-3 py-2 text-left text-[13px] font-bold transition ${
                selected
                  ? "border-brand bg-brand/5 text-brand"
                  : "border-edge bg-surface text-ink-muted"
              } ${editable && !selected ? "hover:border-brand/50" : ""}`}
            >
              {option.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={option.previewUrl}
                  alt=""
                  className="size-8 rounded-[7px] object-cover ring-1 ring-black/10"
                />
              ) : (
                <span className="size-5 rounded-full bg-brand-tint ring-1 ring-black/10" />
              )}
              {option.label}
            </button>
          );
        })}
      </div>
      <input type="hidden" name={fieldKey} value={value} readOnly />
    </div>
  );
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

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
};

export function StudioWorkspace({
  selectedProduct,
  selectedTemplate,
  initialContents,
  initialSize,
  versionsBySize,
  canReview,
  canDownloadDraftPreviews,
}: {
  selectedProduct: StudioProduct;
  selectedTemplate: StudioTemplate;
  initialContents: StudioContent[];
  initialSize: string | null;
  versionsBySize: Record<string, StudioContent[]>;
  canReview: boolean;
  canDownloadDraftPreviews: boolean;
}) {
  const router = useRouter();
  const sizes = useMemo(
    () =>
      selectedTemplate.platformManifest
        ? getTemplateBundleSupportedSizes(selectedTemplate.platformManifest)
        : [],
    [selectedTemplate.platformManifest]
  );
  const [size, setSize] = useState<string>(
    initialSize && sizes.includes(initialSize) ? initialSize : sizes[0]
  );
  const initialContentsBySize = useMemo(() => {
    const entries: Partial<Record<string, StudioContent>> = {};
    for (const item of initialContents) {
      const itemSize = generatedContentSizeKey(item, sizes[0], sizes);
      if (!entries[itemSize]) entries[itemSize] = item;
    }
    return entries;
  }, [initialContents, sizes]);
  const initialContentsSignature = useMemo(
    () =>
      JSON.stringify({
        initialSize,
        contents: initialContents.map((item) => [
          item.id,
          item.outputSize,
          item.updatedAt,
          item.structured_fields,
        ]),
      }),
    [initialContents, initialSize]
  );
  const initialContent = initialContentsBySize[size] ?? initialContents[0] ?? null;
  const [campaignSourceContentId, setCampaignSourceContentId] = useState<string | null>(
    initialContent?.id ?? null
  );
  const [language, setLanguage] = useState("English");
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null);
  const [contentsBySize, setContentsBySize] = useState<
    Partial<Record<string, StudioContent>>
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
  const [selectedBackgroundOverride, setSelectedBackgroundOverride] = useState(
    initialContent?.structured_fields?.[BACKGROUND_CHOICE_FIELD] ??
      selectedTemplate.default_copy[BACKGROUND_CHOICE_FIELD] ??
      ""
  );
  const [selectedProductVariantOverride, setSelectedProductVariantOverride] = useState(
    initialContent?.structured_fields?.[PRODUCT_VARIANT_FIELD] ??
      selectedTemplate.default_copy[PRODUCT_VARIANT_FIELD] ??
      ""
  );
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportScale, setExportScale] = useState<ExportScale>("1");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryUntil, setRetryUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [saveState, setSaveState] = useState<
    "idle" | "unsaved" | "saving" | "saved" | "error"
  >("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [overflowFields, setOverflowFields] = useState<string[]>([]);
  const [textLayoutByField, setTextLayoutByField] = useState<
    Record<string, TemplateBundleTextLayout> | undefined
  >(undefined);
  const saveSequence = useRef(0);
  const retrySecondsRemaining = retryUntil
    ? Math.max(0, Math.ceil((retryUntil - now) / 1000))
    : 0;
  const generationPaused = retrySecondsRemaining > 0;
  const generationBlocked = generationPaused || saveState === "saving";
  const generationPauseLabel =
    saveState === "saving"
      ? "Saving draft…"
      : generationPaused
        ? `Try again in ${formatRetryWait(retrySecondsRemaining)}`
        : null;

  const mode = resolveStudioMode({
    hasContent: content !== null,
    status: content?.status,
    canEditContent: content?.canEdit ?? false,
    canReview,
  });
  const editable = mode === "create" || mode === "edit";
  const activeFields = draftFields;
  const activeVariantFields = useMemo(
    () =>
      selectedTemplate.platformManifest
        ? getTemplateBundleVariantFields(selectedTemplate.platformManifest, size)
        : selectedTemplate.editable_fields.map((key) => ({
            key,
            label: key,
            type: "text" as const,
            source: "user" as const,
            required: selectedTemplate.required_fields.includes(key),
          })),
    [
      selectedTemplate.editable_fields,
      selectedTemplate.platformManifest,
      selectedTemplate.required_fields,
      size,
    ]
  );
  const activeEditableFields = useMemo(
    () =>
      selectedTemplate.platformManifest
        ? studioEditableTemplateFields(activeVariantFields).map((field) => field.key)
        : activeVariantFields.map((field) => field.key),
    [activeVariantFields, selectedTemplate.platformManifest]
  );
  const activeLayoutFields = useMemo(
    () => activeVariantFields.map((field) => field.key),
    [activeVariantFields]
  );
  const activeAssetChoiceFields = useMemo(
    () =>
      selectedTemplate.platformManifest
        ? getTemplateBundleVariantAssetChoiceFields(selectedTemplate.platformManifest, size)
        : [],
    [selectedTemplate.platformManifest, size]
  );
  const backgroundOptions = useMemo(
    () =>
      selectedTemplate.platformManifest
        ? getTemplateBundleVariantBackgroundOptions(selectedTemplate.platformManifest, size)
        : [],
    [selectedTemplate.platformManifest, size]
  );
  const hasBackgroundOptions = backgroundOptions.length > 1;
  const selectedBackgroundKey =
    selectedBackgroundOverride ||
    draftFields[BACKGROUND_CHOICE_FIELD] ||
    backgroundOptions[0]?.key ||
    "default";
  const selectedProductVariantKey =
    selectedProductVariantOverride ||
    draftFields[PRODUCT_VARIANT_FIELD] ||
    selectedTemplate.assetChoiceOptionsByField?.[PRODUCT_VARIANT_FIELD]?.[0]?.key ||
    selectedTemplate.default_copy[PRODUCT_VARIANT_FIELD] ||
    "";
  const previewFields: Record<string, string> = useMemo(
    () => ({
      ...draftFields,
      [BACKGROUND_CHOICE_FIELD]: selectedBackgroundKey,
      [PRODUCT_VARIANT_FIELD]: selectedProductVariantKey,
    }),
    [draftFields, selectedBackgroundKey, selectedProductVariantKey]
  );
  const persistedFieldKeys = useMemo(
    () =>
      hasBackgroundOptions
        ? [...activeEditableFields, ...activeAssetChoiceFields.map((field) => field.key), BACKGROUND_CHOICE_FIELD]
        : [...activeEditableFields, ...activeAssetChoiceFields.map((field) => field.key)],
    [activeAssetChoiceFields, activeEditableFields, hasBackgroundOptions]
  );
  const activeRequiredFields = useMemo(
    () =>
      (selectedTemplate.platformManifest
        ? studioEditableTemplateFields(activeVariantFields)
        : activeVariantFields
      )
        .filter((field) => field.required !== false)
        .map((field) => field.key),
    [activeVariantFields, selectedTemplate.platformManifest]
  );
  const activeFieldLimits = selectedTemplate.platformManifest
    ? getTemplateBundleVariantFieldLimits(selectedTemplate.platformManifest, size)
    : selectedTemplate.field_limits;
  const requiredFieldSet = useMemo(
    () => new Set(activeRequiredFields),
    [activeRequiredFields]
  );

  const issuesByField = useMemo(
    () =>
      Object.fromEntries(
        activeEditableFields.map((key) => [
          key,
          fieldIssues(draftFields[key], activeFieldLimits[key], requiredFieldSet.has(key)),
        ])
      ),
    [activeEditableFields, activeFieldLimits, draftFields, requiredFieldSet]
  );
  const hasIssues = activeEditableFields.some((key) => issuesByField[key].length > 0);
  const hasLayoutOverflow = overflowFields.length > 0;
  const fitCheckSignature = useMemo(
    () =>
      JSON.stringify(activeLayoutFields.map((key) => [key, draftFields[key] ?? ""])),
    [activeLayoutFields, draftFields]
  );
  const dirty =
    mode === "edit" &&
    content !== null &&
    persistedFieldKeys.some(
      (key) => (draftFields[key] ?? "") !== (savedFields[key] ?? "")
    );
  const pickerOnlyDirty =
    dirty &&
    content !== null &&
    activeEditableFields.every(
      (key) => (draftFields[key] ?? "") === (savedFields[key] ?? "")
    ) &&
    [BACKGROUND_CHOICE_FIELD, PRODUCT_VARIANT_FIELD].some(
      (key) => (draftFields[key] ?? "") !== (savedFields[key] ?? "")
    );
  const exportAllowed =
    !!content &&
    content.status === "approved" &&
    !dirty &&
    !hasIssues &&
    !hasLayoutOverflow &&
    saveState !== "saving";
  const dims =
    (selectedTemplate.platformManifest
      ? getTemplateBundleVariantDimensions(selectedTemplate.platformManifest, size)
      : null) ??
    knownSizeDimensions(size) ?? { w: 1080, h: 1080 };
  const activeSizeLabel = selectedTemplate.platformManifest
    ? getTemplateBundleVariantLabel(selectedTemplate.platformManifest, size)
    : sizeLabel(size);
  const originalPreviewUrl =
    selectedTemplate.referenceAssetBySize?.[size] ||
    (selectedTemplate.platformAssignmentId
      ? platformTemplatePreviewUrl(selectedTemplate.platformAssignmentId, size)
      : templatePreviewUrl(selectedTemplate.id, size));
  const referencePreviewUrls = useMemo(
    () =>
      Object.fromEntries(
        sizes.map((key) => [
          key,
          selectedTemplate.referenceAssetBySize?.[key] ||
            (selectedTemplate.platformAssignmentId
              ? platformTemplatePreviewUrl(selectedTemplate.platformAssignmentId, key)
              : templatePreviewUrl(selectedTemplate.id, key)),
        ])
      ),
    [
      selectedTemplate.id,
      selectedTemplate.platformAssignmentId,
      selectedTemplate.referenceAssetBySize,
      sizes,
    ]
  );
  const [showOriginal, setShowOriginal] = useState(false);
  const isBrandReferenceView = showOriginal || (!content && !hasAnyGeneratedDraft);
  const generatedPreviewUrl = content
    ? draftPreviewUrl(content.id, size, savedAt ?? content.id)
    : null;
  const previewUrl = showOriginal || !generatedPreviewUrl ? originalPreviewUrl : generatedPreviewUrl;
  const draftPreviewDownloadAllowed =
    !!content &&
    !isBrandReferenceView &&
    canDownloadDraftPreviews &&
    !exportAllowed &&
    !dirty &&
    !hasIssues &&
    !hasLayoutOverflow &&
    saveState !== "saving" &&
    saveState !== "unsaved";
  const downloadDisabledReason = isBrandReferenceView
    ? undefined
    : content
      ? exportAllowed
        ? undefined
        : canDownloadDraftPreviews
          ? dirty || saveState === "unsaved" || saveState === "saving"
            ? "Wait for autosave before downloading the draft preview"
            : hasIssues || hasLayoutOverflow
              ? "Fix copy limits before downloading the draft preview"
              : undefined
          : "Generated assets can be downloaded after approval"
      : "Generate this size before downloading it";
  const downloadDisabled = Boolean(downloadDisabledReason);
  const versions = versionsBySize[size] ?? [];

  useEffect(() => {
    const nextSize =
      initialSize && sizes.includes(initialSize)
        ? initialSize
        : (initialContents[0]?.outputSize && sizes.includes(initialContents[0].outputSize)
            ? initialContents[0].outputSize
            : sizes[0]);
    if (!nextSize) return;
    const nextContent =
      initialContentsBySize[nextSize] ?? initialContents[0] ?? null;
    const nextFields = nextContent?.structured_fields ?? selectedTemplate.default_copy;

    // This effect is a route/server-state reset boundary: when the selected
    // template's initial payload changes, the Studio draft state must reset
    // together. Phase 6 should replace this cluster with a reducer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSize(nextSize);
    setContentsBySize(initialContentsBySize);
    setCampaignSourceContentId(nextContent?.id ?? null);
    setDraftFields(nextFields);
    setSavedFields(nextFields);
    setSelectedBackgroundOverride(String(nextFields[BACKGROUND_CHOICE_FIELD] ?? ""));
    setSelectedProductVariantOverride(
      String(nextFields[PRODUCT_VARIANT_FIELD] ?? "")
    );
    setHasManualEdits(nextContent?.manuallyEdited ?? false);
    setSelectedRevision(null);
    setShowOriginal(false);
    setError(null);
    setCopied(false);
    setOverflowFields([]);
    setTextLayoutByField(undefined);
    setSaveState("idle");
    setSavedAt(null);
  }, [
    initialContentsBySize,
    initialContentsSignature,
    initialSize,
    selectedTemplate.default_copy,
    sizes,
  ]);

  function confirmDiscardUnsavedChanges() {
    if (!dirty) return true;
    return window.confirm("You have unsaved copy edits. Discard them and continue?");
  }

  // Debounced measured-fit check. The visible Studio editing preview renders
  // locally so background and text edits feel instant. This server check only
  // drives overflow/advisory state and submit readiness.
  useEffect(() => {
    let cancelled = false;
    let timer: number;
    if (!content || !selectedTemplate.platformManifest) {
      timer = window.setTimeout(() => {
        if (!cancelled) {
          setOverflowFields([]);
          setTextLayoutByField(undefined);
        }
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }
    const showOverflowAdvisory = mode === "edit" && !hasIssues;
    const snapshot = Object.fromEntries(JSON.parse(fitCheckSignature)) as Record<
      string,
      string
    >;
    timer = window.setTimeout(async () => {
      const result = await checkDraftStructuredFieldsFit(content.id, snapshot);
      if (cancelled) return;
      if ("error" in result) {
        if (showOverflowAdvisory) setOverflowFields(["layout"]);
        return;
      }
      setTextLayoutByField(result.textLayoutByField);
      if (showOverflowAdvisory) setOverflowFields(result.overflowFields);
      else if (mode === "edit") setOverflowFields([]);
    }, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    content,
    fitCheckSignature,
    hasIssues,
    mode,
    selectedTemplate.platformManifest,
    size,
  ]);

  useEffect(() => {
    if (!retryUntil) return undefined;
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
    if (typeof window === "undefined") return undefined;
    const timer = window.setTimeout(() => {
      for (const src of Object.values(referencePreviewUrls)) {
        const image = new Image();
        image.decoding = "async";
        image.src = src;
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [referencePreviewUrls]);

  useEffect(() => {
    if (!dirty || !content || mode !== "edit") return undefined;
    if (hasIssues || hasLayoutOverflow) return undefined;

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
  }, [content, dirty, draftFields, hasIssues, hasLayoutOverflow, mode, size]);

  function selectSize(nextSize: string) {
    if (nextSize !== size && !confirmDiscardUnsavedChanges()) return;
    const nextContent = contentsBySize[nextSize] ?? null;
    const nextFields = {
      ...(nextContent ? nextContent.structured_fields : selectedTemplate.default_copy),
      [BACKGROUND_CHOICE_FIELD]: selectedBackgroundKey,
      [PRODUCT_VARIANT_FIELD]: selectedProductVariantKey,
    };
    setSize(nextSize);
    if (nextContent) setCampaignSourceContentId(nextContent.id);
    setDraftFields(nextFields);
    setSavedFields(nextFields);
    setSelectedBackgroundOverride(String(nextFields[BACKGROUND_CHOICE_FIELD] ?? ""));
    setSelectedProductVariantOverride(
      String(nextFields[PRODUCT_VARIANT_FIELD] ?? "")
    );
    setHasManualEdits(nextContent?.manuallyEdited ?? false);
    setError(null);
    setCopied(false);
    setOverflowFields([]);
    setTextLayoutByField(undefined);
    setSaveState("idle");
    setSavedAt(null);
    setShowOriginal(false);
  }

  function updateField(key: string, value: string) {
    const nextFields = { ...draftFields, [key]: value };
    if (key === BACKGROUND_CHOICE_FIELD) setSelectedBackgroundOverride(value);
    if (key === PRODUCT_VARIANT_FIELD) setSelectedProductVariantOverride(value);
    const nextDirty = persistedFieldKeys.some(
      (field) => (nextFields[field] ?? "") !== (savedFields[field] ?? "")
    );
    setSaveState(nextDirty ? "unsaved" : "saved");
    setHasManualEdits(nextDirty ? true : (content?.manuallyEdited ?? false));
    if (key !== BACKGROUND_CHOICE_FIELD) setTextLayoutByField(undefined);
    setDraftFields(nextFields);
  }

  async function generate() {
    if (generationPaused) return;
    if (saveState === "saving") {
      setError("Studio is still saving your last edit. Try again in a second.");
      return;
    }
    if (dirty && !pickerOnlyDirty) {
      if (!confirmDiscardUnsavedChanges()) return;
      saveSequence.current += 1;
      setDraftFields(savedFields);
      setSavedFields(savedFields);
      setHasManualEdits(content?.manuallyEdited ?? false);
      setSaveState("saved");
      setSavedAt(null);
      setOverflowFields([]);
      setTextLayoutByField(undefined);
    }
    saveSequence.current += 1;
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
          backgroundChoice: selectedBackgroundKey,
          productVariantChoice: selectedProductVariantKey,
          revisions: selectedRevision ? [selectedRevision] : [],
          replaceContentId: mode === "edit" && content ? content.id : undefined,
          sourceContentId:
            mode === "edit" && content
              ? undefined
              : (content?.id ?? campaignSourceContentId ?? undefined),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        const retryAfterSeconds = retryAfterSecondsFromPayload(result);
        if (retryAfterSeconds) setRetryUntil(Date.now() + retryAfterSeconds * 1000);
        setError(result.error ?? "Generation failed.");
        return;
      }
      setRetryUntil(null);
      const returnedFields = result.structured_fields as Record<string, string>;
      const generatedFields = {
        ...returnedFields,
        [BACKGROUND_CHOICE_FIELD]: selectedBackgroundKey,
        [PRODUCT_VARIANT_FIELD]: selectedProductVariantKey,
      };
      const nextContent: StudioContent = {
        id: result.contentId as string,
        title: result.title as string,
        status: "draft",
        rejectionNote: null,
        structured_fields: generatedFields,
        outputSize: (result.outputSize as string | null) ?? size,
        campaignRootContentId:
          (result.campaignRootContentId as string | undefined) ??
          campaignSourceContentId ??
          (result.contentId as string),
        manuallyEdited: false,
        canEdit: true,
        updatedAt: new Date().toISOString(),
      };
      const nextContentSize = nextContent.outputSize ?? size;
      setContentsBySize((current) => ({ ...current, [nextContentSize]: nextContent }));
      setCampaignSourceContentId(nextContent.id);
      setSize(nextContentSize);
      setDraftFields(nextContent.structured_fields);
      setSavedFields(nextContent.structured_fields);
      setSelectedBackgroundOverride(selectedBackgroundKey);
      setSelectedProductVariantOverride(selectedProductVariantKey);
      setTextLayoutByField(undefined);
      setSaveState("saved");
      setSavedAt(new Date().toISOString());
      setHasManualEdits(false);
      setSelectedRevision(null);
      setShowOriginal(false);
      router.replace(studioContentUrl(nextContent.id, nextContentSize), { scroll: false });
    } catch {
      setError("Generation failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyText() {
    setError(null);
    try {
      if (content && !exportAllowed) {
        throw new Error("Generated copy must be approved before export.");
      }
      if (content) {
        const response = await fetch(`/api/export/${content.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: "clipboard_text", surface: "studio", size }),
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
      if (isBrandReferenceView) {
        const filename = `${selectedProduct.name}-${selectedTemplate.variant}-brand-reference-${size}`
          .replace(/[^\w]+/g, "-")
          .toLowerCase();
        const serverPreviewUrl = new URL(originalPreviewUrl, window.location.origin);
        serverPreviewUrl.searchParams.set("format", exportFormat);
        serverPreviewUrl.searchParams.set("scale", exportScale);
        serverPreviewUrl.searchParams.set("download", "1");
        await downloadUrl(
          serverPreviewUrl.toString(),
          `${filename}.${exportFormat === "jpeg" ? "jpg" : exportFormat}`
        );
        return;
      }

      if (content && draftPreviewDownloadAllowed) {
        const serverDraftPreviewUrl = new URL(
          draftPreviewUrl(content.id, size, savedAt ?? content.id),
          window.location.origin
        );
        serverDraftPreviewUrl.searchParams.set("format", exportFormat);
        serverDraftPreviewUrl.searchParams.set("scale", exportScale);
        serverDraftPreviewUrl.searchParams.set("download", "1");
        const filename = `${selectedProduct.name}-${selectedTemplate.variant}-${size}-draft-preview${
          exportScale === "2" ? "-2x" : ""
        }`
          .replace(/[^\w]+/g, "-")
          .toLowerCase();
        await downloadUrl(
          serverDraftPreviewUrl.toString(),
          `${filename}.${exportFormat === "jpeg" ? "jpg" : exportFormat}`
        );
        return;
      }

      if (!content || !exportAllowed) {
        throw new Error("Generated content must be approved before export.");
      }

      const response = await fetch(`/api/export/${content.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: exportFormat, surface: "studio", size }),
      });
      if (!response.ok) throw new Error("Export could not be recorded.");
      const serverRenderUrl = new URL(renderUrl(content.id, size), window.location.origin);
      serverRenderUrl.searchParams.set("format", exportFormat);
      serverRenderUrl.searchParams.set("scale", exportScale);
      serverRenderUrl.searchParams.set("download", "1");
      const filename = `${selectedProduct.name}-${selectedTemplate.variant}-${size}${
        exportScale === "2" ? "-2x" : ""
      }`
        .replace(/[^\w]+/g, "-")
        .toLowerCase();
      await downloadUrl(
        serverRenderUrl.toString(),
        `${filename}.${exportFormat === "jpeg" ? "jpg" : exportFormat}`
      );
    } catch {
      setError("The preview could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  async function submit() {
    if (!content || dirty || hasIssues || hasLayoutOverflow || saveState === "saving") return;
    setSubmitting(true);
    setError(null);
    const result = await submitForReview(content.id);
    if ("error" in result) {
      setError(result.error);
    } else {
      setContentsBySize((current) => {
        const existing = current[size];
        if (!existing || existing.id !== content.id) return current;
        return { ...current, [size]: { ...existing, status: "in_review" } };
      });
      router.refresh();
    }
    setSubmitting(false);
  }

  function markReviewed(status: "approved" | "rejected", rejectionNote?: string | null) {
    if (!content) return;
    const reviewedAt = new Date().toISOString();
    setContentsBySize((current) => {
      const existing = current[size];
      if (!existing || existing.id !== content.id) return current;
      return {
        ...current,
        [size]: {
          ...existing,
          status,
          rejectionNote: status === "approved" ? null : rejectionNote ?? existing.rejectionNote,
          canEdit: status === "rejected",
          updatedAt: reviewedAt,
        },
      };
    });
    setSaveState("saved");
    setSavedAt(reviewedAt);
  }

  const studioTitle = content?.title || `${selectedProduct.name} — ${selectedTemplate.variant}`;

  return (
    <div className="flex h-screen min-h-[720px] flex-col overflow-hidden bg-page">
      <header className="flex h-[76px] shrink-0 items-center justify-between gap-4 border-b border-edge bg-surface px-10">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href={content ? "/content" : `/products/${selectedProduct.id}?view=templates`}
            className="shrink-0 text-[14px] font-semibold text-ink-muted hover:text-brand"
          >
            ← {content ? "Content" : "Product"}
          </Link>
          <span className="h-5 w-px shrink-0 bg-edge" aria-hidden="true" />
          <h1 className="truncate text-[18px] font-bold tracking-[-0.02em] text-ink">
            {studioTitle}
          </h1>
          {content && (
            <Badge
              variant={
                content.status === "approved"
                  ? "approve"
                  : content.status === "in_review"
                    ? "warn"
                    : content.status === "rejected"
                      ? "reject"
                      : "neutral"
              }
            >
              {STATUS_LABEL[content.status] ?? content.status}
            </Badge>
          )}
        </div>
        {canReview && content ? (
          <span className="shrink-0 text-[14px] font-bold text-brand">
            {mode === "review" ? "Reviewer view" : "Preview as reviewer"}
          </span>
        ) : (
          <span className="shrink-0 text-[13px] font-semibold text-ink-faint">
            {selectedProduct.name}
          </span>
        )}
      </header>

      <div
        className="grid min-h-0 flex-1 overflow-hidden"
        style={{ gridTemplateColumns: "minmax(360px, 400px) minmax(0, 1fr)" }}
      >
        <aside className="flex min-h-0 flex-col gap-7 overflow-y-auto border-r border-edge bg-surface px-10 py-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <span className="text-label text-ink-faint">Product & variant</span>
              <select
                value={`${selectedProduct.name} · ${selectedTemplate.variant}`}
                disabled
                aria-label="Product and template variant"
                className="h-[48px] w-full rounded-[8px] border border-edge-strong bg-surface px-4 text-[14px] font-semibold text-ink outline-none disabled:opacity-100"
              >
                <option>{selectedProduct.name} · {selectedTemplate.variant}</option>
              </select>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-label text-ink-faint">Size / format</span>
              <select
                value={size}
                onChange={(event) => selectSize(event.target.value)}
                disabled={busy}
                aria-label="Size and format"
                className="h-[48px] w-full rounded-[8px] border border-edge-strong bg-surface px-4 text-[14px] font-semibold text-ink outline-none focus:border-brand disabled:opacity-60"
              >
                {sizes.map((key) => {
                  const metaDims =
                    (selectedTemplate.platformManifest
                      ? getTemplateBundleVariantDimensions(selectedTemplate.platformManifest, key)
                      : knownSizeDimensions(key)) ?? undefined;
                  const label = selectedTemplate.platformManifest
                    ? getTemplateBundleVariantLabel(selectedTemplate.platformManifest, key)
                    : sizeLabel(key);
                  return (
                    <option key={key} value={key}>
                      {label}{metaDims ? ` · ${metaDims.w}×${metaDims.h}` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {mode === "review" && content && (
            <StudioReviewActions contentId={content.id} onReviewed={markReviewed} />
          )}

          {!showOriginal &&
            selectedTemplate.platformManifest &&
            activeAssetChoiceFields.map((field) => (
              <StudioAssetChoicePicker
                key={field.key}
                fieldKey={field.key}
                label={field.label}
                options={selectedTemplate.assetChoiceOptionsByField?.[field.key] ?? []}
                value={String(previewFields[field.key] ?? "")}
                editable={editable}
                onChange={(value) => updateField(field.key, value)}
              />
            ))}

          {!showOriginal && selectedTemplate.platformManifest && hasBackgroundOptions && (
            <StudioBackgroundPicker
              options={backgroundOptions}
              value={selectedBackgroundKey}
              editable={editable}
              onChange={(value) => updateField(BACKGROUND_CHOICE_FIELD, value)}
            />
          )}

          <StudioFields
            fields={activeEditableFields}
            requiredFields={activeRequiredFields}
            values={activeFields}
            limits={activeFieldLimits}
            editable={editable}
            issuesByField={issuesByField}
            overflowFields={overflowFields}
            onChange={updateField}
          />

          {mode === "create" && (
            <StudioGeneratePanel
              language={language}
              onLanguageChange={setLanguage}
              selectedRevision={selectedRevision}
              onRevisionChange={setSelectedRevision}
              onGenerate={generate}
              busy={busy}
              generationPaused={generationBlocked}
              retryLabel={generationPauseLabel}
              buttonLabel={
                selectedRevision
                  ? `Generate ${activeSizeLabel} with refinement`
                  : `Generate ${activeSizeLabel} draft`
              }
              error={error}
            />
          )}

          {mode === "edit" && (
            <StudioGeneratePanel
              language={language}
              onLanguageChange={setLanguage}
              selectedRevision={selectedRevision}
              onRevisionChange={setSelectedRevision}
              onGenerate={generate}
              busy={busy}
              generationPaused={generationBlocked}
              retryLabel={generationPauseLabel}
              buttonLabel={selectedRevision ? "Apply refinement to draft" : "Regenerate draft"}
              error={error}
            />
          )}

          {mode === "read" && content?.status === "approved" && (
            <StudioGeneratePanel
              language={language}
              onLanguageChange={setLanguage}
              selectedRevision={selectedRevision}
              onRevisionChange={setSelectedRevision}
              onGenerate={generate}
              busy={busy}
              generationPaused={generationBlocked}
              retryLabel={generationPauseLabel}
              buttonLabel={
                selectedRevision
                  ? `Create new ${activeSizeLabel} draft with refinement`
                  : `Create new ${activeSizeLabel} draft`
              }
              error={error}
            />
          )}

          {mode === "edit" && content && hasManualEdits && (
            <p className="rounded-control border border-warn-border bg-warn-tint px-3 py-2 text-[11.5px] leading-relaxed text-warn">
              Manual edits are tracked separately from the generated copy and require reviewer
              approval before export.
            </p>
          )}
          {mode === "edit" && content?.status === "rejected" && content.rejectionNote && (
            <div className="rounded-control border border-reject-border bg-reject-tint px-3 py-2.5">
              <p className="text-[11.5px] font-bold text-reject">Changes requested</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                {content.rejectionNote}
              </p>
            </div>
          )}
          {mode === "edit" && content && (
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
                  {new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </div>
          )}
          {mode === "edit" && content && (
            <Button
              type="button"
              variant="secondary"
              onClick={submit}
              disabled={submitting || dirty || hasIssues || hasLayoutOverflow || saveState === "saving" || saveState === "error"}
            >
              {submitting ? "Submitting…" : "Submit for review"}
            </Button>
          )}
          {mode === "review" && (
            <p className="rounded-control bg-brand-tint px-3 py-2 text-[11.5px] font-semibold text-brand">
              Awaiting your review. Editing is paused until it is approved or returned.
            </p>
          )}
          {mode === "read" && content?.status === "in_review" && (
            <p className="rounded-control bg-brand-tint px-3 py-2 text-[11.5px] font-semibold text-brand">
              Submitted for review. Editing is paused until it is approved or returned.
            </p>
          )}
          {mode === "read" && content?.status === "approved" && (
            <p className="rounded-control bg-approve-tint px-3 py-2 text-[11.5px] font-semibold text-approve">
              Approved snapshot. Download is enabled.
            </p>
          )}
          {mode === "read" && content?.status === "rejected" && (
            <p className="rounded-control bg-page px-3 py-2 text-[11.5px] leading-relaxed text-ink-muted">
              Changes were requested on this draft.
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={copyText}
            disabled={!!content && !exportAllowed}
            title={content && !exportAllowed ? "Generated copy can be copied after approval" : undefined}
          >
            {copied ? "Copied" : `Copy ${content ? "generated" : "original"} copy`}
          </Button>

          {versions.length > 1 && (
            <StudioVersions versions={versions} currentContentId={content?.id ?? null} size={size} />
          )}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col bg-page">
          <div className="flex min-h-[80px] items-center justify-between gap-5 border-b border-edge bg-surface px-10 py-5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="rounded-full bg-page px-4 py-2 text-[13px] font-bold text-ink">
                {selectedProduct.name} · {selectedTemplate.variant}
              </span>
              <span className="text-ink-faint">|</span>
              <span className="rounded-full bg-page px-4 py-2 text-[13px] font-bold text-ink">
                {activeSizeLabel}
              </span>
              <span className="text-[13px] font-semibold text-ink-faint">
                {dims.w}×{dims.h}
              </span>
            </div>

            {hasAnyGeneratedDraft && content && (
              <div className="flex shrink-0 items-center gap-1 rounded-full bg-page p-1">
                <button
                  type="button"
                  onClick={() => setShowOriginal(false)}
                  className={`rounded-full px-5 py-2 text-[13px] font-bold transition-colors ${
                    !showOriginal ? "bg-surface text-ink shadow-sm" : "text-ink-faint"
                  }`}
                >
                  Your draft
                </button>
                <button
                  type="button"
                  onClick={() => setShowOriginal(true)}
                  className={`rounded-full px-5 py-2 text-[13px] font-bold transition-colors ${
                    showOriginal ? "bg-surface text-ink shadow-sm" : "text-ink-faint"
                  }`}
                >
                  Brand reference
                </button>
              </div>
            )}
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-page">
            {busy && <GenerationLoader />}
            {!content && hasAnyGeneratedDraft && !showOriginal && !selectedTemplate.platformManifest ? (
              <MissingDraftFrame
                width={dims.w}
                height={dims.h}
                sizeLabel={activeSizeLabel}
                busy={busy}
                onGenerate={generate}
              />
            ) : selectedTemplate.platformManifest && !showOriginal ? (
              <LiveTemplatePreviewFrame
                manifest={selectedTemplate.platformManifest}
                variantKey={size}
                fields={previewFields}
                assetUrlByPath={selectedTemplate.platformAssetUrlByPath}
                damAssetUrlById={selectedTemplate.damAssetUrlById}
                textLayoutByField={textLayoutByField}
                width={dims.w}
                height={dims.h}
                updating={saveState === "saving"}
              />
            ) : (
              <ServerPreviewFrame
                src={previewUrl}
                width={dims.w}
                height={dims.h}
                updating={false}
              />
            )}
          </div>
          <StudioExportBar
            exportFormat={exportFormat}
            onExportFormatChange={setExportFormat}
            exportScale={exportScale}
            onExportScaleChange={setExportScale}
            onDownload={download}
            downloading={downloading}
            downloadDisabled={downloadDisabled}
            downloadDisabledReason={downloadDisabledReason}
            canDownloadDraft={draftPreviewDownloadAllowed}
          />
        </section>
      </div>
    </div>
  );
}
