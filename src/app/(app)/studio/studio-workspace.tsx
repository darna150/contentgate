"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContextPath } from "@/components/context-path";
import { useUiUxMeasurement } from "@/components/uiux-measurement-provider";
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
import { revisionAvailabilityIssue } from "@/lib/revision-contract";
import {
  STUDIO_PRODUCT_VARIANT_FIELD,
  studioDirtyState,
  studioFieldsForContent,
  studioInitialContentsBySize,
  studioInitialSize,
  studioPersistedFieldKeys,
  studioPickerFieldKeys,
  studioPreviewFields,
} from "@/lib/studio-state";
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
import { fieldLabel } from "@/lib/templates";
import type { TemplateBundleTextLayout } from "@/lib/template-platform/render";
import { fieldIssues } from "@/lib/template-fields";
import { templateReferenceExportUrl } from "@/lib/studio-export";
import {
  getTemplateProductAssetPath,
  getTemplateProductAssetPaths,
} from "@/lib/template-platform/live-preview-assets";
import {
  checkDraftStructuredFieldsFit,
  submitForReview,
  updateStructuredFields,
} from "../content/actions";
import { loadStudioVariantAssetUrls } from "./studio-assets-actions";
import {
  GenerationLoader,
  LiveTemplatePreviewFrame,
  MissingDraftFrame,
  ServerPreviewFrame,
} from "./studio-preview";
import type { PreviewZoom } from "@/lib/studio-preview-scale";
import { StudioBackgroundPicker } from "./studio-background-picker";
import { StudioFields } from "./studio-fields";
import { StudioGeneratePanel } from "./studio-generate-panel";
import { resolveStudioMode } from "./studio-mode";
import { StudioReviewActions } from "./studio-review-actions";
import { StudioReviewSummary } from "./studio-review-summary";
import { StudioExportBar, StudioToolbar, type ExportFormat, type ExportScale } from "./studio-toolbar";
import { StudioVersions } from "./studio-versions";
import type {
  StudioContent,
  StudioProduct,
  StudioTemplate,
} from "./studio-data";

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

const PRODUCT_VARIANT_FIELD = STUDIO_PRODUCT_VARIANT_FIELD;

// Hold preloaded images for the lifetime of the Studio session. Keeping the
// decoded 600px product previews resident makes a product click as immediate
// as a background click, including when the user changes format.
const preloadedStudioImages = new Map<string, HTMLImageElement>();

function preloadStudioImage(src: string) {
  if (!src || preloadedStudioImages.has(src)) return;
  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    void image.decode().catch(() => undefined);
  };
  image.onerror = () => {
    preloadedStudioImages.delete(src);
  };
  preloadedStudioImages.set(src, image);
  image.src = src;
}

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
  const hasMultipleOptions = options.length > 1;
  return (
    <div className="flex flex-col gap-3 border-t border-edge pt-5" data-testid={`studio-asset-choice-${fieldKey}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-label text-ink-faint">{label}</span>
          {hasMultipleOptions && (
            <p className="mt-2 text-[14px] leading-6 text-ink-muted">
              Select an approved asset for this locked image slot. Layout, scale, crop, and export
              rules remain controlled by the template.
            </p>
          )}
        </div>
        {!hasMultipleOptions && (
          <Badge variant="neutral">1 option</Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const selected = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              disabled={!editable || !hasMultipleOptions}
              onClick={() => editable && hasMultipleOptions && onChange(option.key)}
              aria-label={`${label}: ${option.label}`}
              className={`flex items-center gap-3 rounded-[10px] border px-3 py-2 text-left text-[13px] font-bold transition ${
                selected
                  ? "border-brand bg-brand/5 text-brand"
                  : "border-edge bg-surface text-ink-muted"
              } ${editable && hasMultipleOptions && !selected ? "hover:border-brand/50" : ""} ${
                !hasMultipleOptions ? "cursor-default" : ""
              }`}
            >
              {option.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={option.previewUrl}
                  alt=""
                  decoding="async"
                  loading="eager"
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
  let response = await fetch(url, { cache: "no-store" });
  if (response.status >= 500) {
    response = await fetch(url, { cache: "no-store" });
  }
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
  returnTo,
}: {
  selectedProduct: StudioProduct;
  selectedTemplate: StudioTemplate;
  initialContents: StudioContent[];
  initialSize: string | null;
  versionsBySize: Record<string, StudioContent[]>;
  canReview: boolean;
  canDownloadDraftPreviews: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const { track } = useUiUxMeasurement();
  const sizes = useMemo(
    () =>
      selectedTemplate.platformManifest
        ? getTemplateBundleSupportedSizes(selectedTemplate.platformManifest)
        : [],
    [selectedTemplate.platformManifest]
  );
  const [size, setSize] = useState<string>(
    studioInitialSize({
      requestedSize: initialSize,
      contents: initialContents,
      supportedSizes: sizes,
    })
  );
  const initialContentsBySize = useMemo(() => {
    return studioInitialContentsBySize(initialContents, sizes);
  }, [initialContents, sizes]);
  const initialResolvedSize = useMemo(
    () =>
      studioInitialSize({
        requestedSize: initialSize,
        contents: initialContents,
        supportedSizes: sizes,
      }),
    [initialContents, initialSize, sizes]
  );
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
  const initialResolvedContent =
    initialContentsBySize[initialResolvedSize] ?? initialContents[0] ?? null;
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
    studioFieldsForContent(initialContent, selectedTemplate.default_copy)
  );
  const [savedFields, setSavedFields] = useState<Record<string, string>>(
    studioFieldsForContent(initialContent, selectedTemplate.default_copy)
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
  const [truncatedFields, setTruncatedFields] = useState<string[]>([]);
  const [textLayoutByField, setTextLayoutByField] = useState<
    Record<string, TemplateBundleTextLayout> | undefined
  >(undefined);
  const [platformAssetUrlByPath, setPlatformAssetUrlByPath] = useState(
    selectedTemplate.platformAssetUrlByPath
  );
  const saveSequence = useRef(0);
  // A response must never be allowed to restore the format/fields that were
  // current when its request began after the user has moved on. This protects
  // us even if a future UI path bypasses the disabled controls below.
  const workspaceInteractionSequence = useRef(0);
  // Asset URLs load after the visible format change. Keep late responses from
  // an older format from surfacing an irrelevant error in the current one.
  const formatAssetLoadSequence = useRef(0);
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
  const hasBackgroundOptions = backgroundOptions.length > 0;
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
  const productPreviewUrls = useMemo(() => {
    const manifest = selectedTemplate.platformManifest;
    if (!manifest) return [];
    const selectedPath = getTemplateProductAssetPath(manifest, selectedProductVariantKey);
    const paths = [
      ...(selectedPath ? [selectedPath] : []),
      ...getTemplateProductAssetPaths(manifest),
    ];
    return Array.from(new Set(paths))
      .map((path) => platformAssetUrlByPath?.[path])
      .filter((url): url is string => Boolean(url));
  }, [
    platformAssetUrlByPath,
    selectedProductVariantKey,
    selectedTemplate.platformManifest,
  ]);
  useEffect(() => {
    productPreviewUrls.forEach(preloadStudioImage);
  }, [productPreviewUrls]);
  const previewFields: Record<string, string> = useMemo(
    () =>
      studioPreviewFields({
        draftFields,
        backgroundKey: selectedBackgroundKey,
        productVariantKey: selectedProductVariantKey,
      }),
    [draftFields, selectedBackgroundKey, selectedProductVariantKey]
  );
  const activeAssetChoiceFieldKeys = useMemo(
    () => activeAssetChoiceFields.map((field) => field.key),
    [activeAssetChoiceFields]
  );
  const persistedFieldKeys = useMemo(
    () =>
      studioPersistedFieldKeys({
        editableFieldKeys: activeEditableFields,
        assetChoiceFieldKeys: activeAssetChoiceFieldKeys,
        includeBackgroundChoice: hasBackgroundOptions,
      }),
    [activeAssetChoiceFieldKeys, activeEditableFields, hasBackgroundOptions]
  );
  const pickerFieldKeys = useMemo(
    () =>
      studioPickerFieldKeys({
        assetChoiceFieldKeys: activeAssetChoiceFieldKeys,
        includeBackgroundChoice: hasBackgroundOptions,
      }),
    [activeAssetChoiceFieldKeys, hasBackgroundOptions]
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
  const unavailableRevisions = useMemo(() => {
    if (!content) return {};
    return Object.fromEntries(
      ["shorter", "longer"].flatMap((revision) => {
        const issue = revisionAvailabilityIssue({
          revision,
          editableFields: activeEditableFields,
          currentFields: draftFields,
          requiredFields: activeRequiredFields,
          fieldLimits: activeFieldLimits,
        });
        return issue ? [[revision, issue]] : [];
      })
    );
  }, [
    activeEditableFields,
    activeFieldLimits,
    activeRequiredFields,
    content,
    draftFields,
  ]);

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
  const truncationWarning =
    truncatedFields.length > 0
      ? `Some copy was shortened to fit the template (${truncatedFields.map(fieldLabel).join(", ")}). Review the draft and regenerate if the meaning changed.`
      : null;
  const hasLayoutOverflow = overflowFields.length > 0;
  const fitCheckSignature = useMemo(
    () =>
      JSON.stringify(activeLayoutFields.map((key) => [key, draftFields[key] ?? ""])),
    [activeLayoutFields, draftFields]
  );
  const { dirty, pickerOnlyDirty } = studioDirtyState({
    mode,
    hasContent: content !== null,
    draftFields,
    savedFields,
    persistedFieldKeys,
    editableFieldKeys: activeEditableFields,
    pickerFieldKeys,
  });
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
  // Static reference thumbnails are deliberately capped at 720px for an
  // instant Studio preview. Downloads must always use the authenticated
  // renderer, which preserves the manifest's exact output dimensions.
  const originalExportUrl = templateReferenceExportUrl({
    templateId: selectedTemplate.id,
    platformAssignmentId: selectedTemplate.platformAssignmentId,
    size,
  });
  useEffect(() => {
    // Warm the current reference immediately, then cache the other format
    // thumbnails once the first image has a head start. Format switches can
    // therefore swap without exposing an empty canvas.
    const images: HTMLImageElement[] = [];
    const warm = (src: string) => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
      images.push(image);
    };
    warm(originalPreviewUrl);

    const remainingReferences = Array.from(
      new Set(Object.values(selectedTemplate.referenceAssetBySize ?? {}))
    ).filter((src) => src !== originalPreviewUrl);
    const timer = window.setTimeout(() => {
      remainingReferences.forEach(warm);
    }, 250);

    return () => {
      window.clearTimeout(timer);
      images.forEach((image) => {
        image.src = "";
      });
    };
  }, [originalPreviewUrl, selectedTemplate.referenceAssetBySize]);
  const [showOriginal, setShowOriginal] = useState(false);
  // Shared by every preview frame, so switching format or toggling the original
  // keeps the reviewer's chosen zoom instead of snapping back to fit.
  const [previewZoom, setPreviewZoom] = useState<PreviewZoom>("fit");
  // A size switch is always a reference-first operation. Keeping the size
  // key separately prevents an old draft renderer from flashing while React
  // reconciles the newly selected dimensions.
  const [referenceLockedSize, setReferenceLockedSize] = useState<string | null>(null);
  const isBrandReferenceView =
    showOriginal || referenceLockedSize === size || (!content && !hasAnyGeneratedDraft);
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
  const previousVersion =
    content ? versions.find((version) => version.id !== content.id) ?? null : null;

  useEffect(() => {
    const nextSize = initialResolvedSize;
    if (!nextSize) return;
    const nextContent = initialResolvedContent;
    const nextFields = studioFieldsForContent(nextContent, selectedTemplate.default_copy);

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
    setShowOriginal(!nextContent);
    setReferenceLockedSize(!nextContent ? nextSize : null);
    setError(null);
    setCopied(false);
    setOverflowFields([]);
    setTextLayoutByField(undefined);
    setPlatformAssetUrlByPath(selectedTemplate.platformAssetUrlByPath);
    setSaveState("idle");
    setSavedAt(null);
  }, [
    initialContentsBySize,
    initialContentsSignature,
    initialResolvedContent,
    initialResolvedSize,
    selectedTemplate.default_copy,
    selectedTemplate.platformAssetUrlByPath,
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
      const result = await checkDraftStructuredFieldsFit(content.id, snapshot).catch(() => ({
        error: "Fit check temporarily unavailable.",
      }));
      if (cancelled) return;
      if ("error" in result) {
        if (result.error.startsWith("Your session expired")) {
          router.push("/login");
          return;
        }
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
    router,
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
    if (!dirty || !content || mode !== "edit") return undefined;
    if (hasIssues || hasLayoutOverflow) return undefined;

    const snapshot = { ...draftFields };
    const sequence = ++saveSequence.current;
    const timer = window.setTimeout(async () => {
      const saveStartedAt = performance.now();
      setSaveState("saving");
      const result = await updateStructuredFields(content.id, snapshot, content.updatedAt).catch(
        () => ({ error: "The save service was briefly unavailable." })
      );
      if (sequence !== saveSequence.current) return;
      if ("error" in result) {
        track("studio_save_completed", {
          duration_ms: Math.round(performance.now() - saveStartedAt),
          outcome: "failed",
        });
        if (result.error.startsWith("Your session expired")) {
          router.push("/login");
          return;
        }
        setSaveState("error");
        setError(result.error);
        return;
      }
      setSavedFields(snapshot);
      setSavedAt(result.savedAt ?? new Date().toISOString());
      setSaveState("saved");
      setHasManualEdits(result.manuallyEdited ?? false);
      setError(null);
      track("studio_save_completed", {
        duration_ms: Math.round(performance.now() - saveStartedAt),
        outcome: "saved",
      });
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
            updatedAt: result.savedAt ?? existing.updatedAt,
          },
        };
      });
    }, 750);
    return () => window.clearTimeout(timer);
  }, [content, dirty, draftFields, hasIssues, hasLayoutOverflow, mode, router, size, track]);

  async function selectSize(nextSize: string) {
    if (busy) return;
    if (nextSize !== size && !confirmDiscardUnsavedChanges()) return;
    const previousSize = size;
    const assetLoadSequence = ++formatAssetLoadSequence.current;
    workspaceInteractionSequence.current += 1;
    const nextContent = contentsBySize[nextSize] ?? null;
    const nextFields = {
      ...(nextContent ? nextContent.structured_fields : selectedTemplate.default_copy),
      [BACKGROUND_CHOICE_FIELD]: selectedBackgroundKey,
      [PRODUCT_VARIANT_FIELD]: selectedProductVariantKey,
    };

    // Switch the author-facing state first. Asset URLs are a progressive
    // enhancement to the working preview; waiting for them made the format
    // control appear to ignore a selection and invited accidental re-clicks.
    setSize(nextSize);
    setReferenceLockedSize(nextSize);
    if (nextContent) setCampaignSourceContentId(nextContent.id);
    setDraftFields(nextFields);
    setSavedFields(nextFields);
    setSelectedBackgroundOverride(String(nextFields[BACKGROUND_CHOICE_FIELD] ?? ""));
    setSelectedProductVariantOverride(
      String(nextFields[PRODUCT_VARIANT_FIELD] ?? "")
    );
    setHasManualEdits(nextContent?.manuallyEdited ?? false);
    setShowOriginal(true);
    setError(null);
    setCopied(false);
    setOverflowFields([]);
    setSaveState("idle");
    setSavedAt(null);
    if (nextSize !== previousSize) {
      track("studio_format_selected", {
        from_format: previousSize,
        to_format: nextSize,
        source_of_change: "explicit",
      });
    }

    if (
      nextSize !== previousSize &&
      selectedTemplate.platformManifest &&
      selectedTemplate.platformAssignmentId
    ) {
      const result = await loadStudioVariantAssetUrls({
        assignmentId: selectedTemplate.platformAssignmentId,
        variantKey: nextSize,
      }).catch(() => ({ error: "", urls: {} }));
      if (assetLoadSequence !== formatAssetLoadSequence.current) return;
      if (result.error) {
        // The authored reference is already available locally. A signed
        // working-preview asset miss should not interrupt format selection or
        // generation; the server renderer will resolve fresh URLs on demand.
        return;
      }
      setPlatformAssetUrlByPath((current) => ({ ...current, ...result.urls }));
    }
  }

  function updateField(key: string, value: string) {
    if (busy) return;
    workspaceInteractionSequence.current += 1;
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
    if (key === BACKGROUND_CHOICE_FIELD || activeAssetChoiceFieldKeys.includes(key)) {
      track("studio_picker_selected", {
        picker_type: key === BACKGROUND_CHOICE_FIELD ? "background" : "asset",
        option_key: value,
        format_key: size,
      });
    }
  }

  async function copyUnsavedFields() {
    const text = activeEditableFields
      .map((field) => `${fieldLabel(field)}: ${draftFields[field] ?? ""}`)
      .join("\\n\\n");
    try {
      await navigator.clipboard.writeText(text);
      setError("Unsaved fields copied. You can now refresh Studio safely.");
    } catch {
      setError("Could not copy unsaved fields. Select and copy them before refreshing Studio.");
    }
  }

  async function generate(copyFromCampaign = false) {
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
    const generationInteractionSequence = workspaceInteractionSequence.current;
    const generationStartedAt = performance.now();
    track("studio_generation_started", {
      format_key: size,
      source_count: 0,
      has_revision: Boolean(selectedRevision),
      copied_from_campaign: copyFromCampaign,
    });
    setBusy(true);
    setError(null);
    setTruncatedFields([]);
    try {
      const assetChoices = Object.fromEntries(
        activeAssetChoiceFieldKeys.flatMap((key) => {
          const value = previewFields[key];
          return typeof value === "string" && value.length > 0
            ? [[key, value] as const]
            : [];
        })
      );
      const regenerateCurrentDraft =
        !!content && ["draft", "rejected"].includes(content.status);
      const continuityCandidate = copyFromCampaign
        ? Object.values(contentsBySize).find(
            (item): item is StudioContent => item?.id === campaignSourceContentId
          ) ?? null
        : null;
      // Formats start independently. A source draft is passed only after the
      // author explicitly chooses Copy from campaign, and only when it uses
      // the same template version.
      const compatibleCampaignSourceId =
        continuityCandidate?.templateVersionId &&
        continuityCandidate.templateVersionId === selectedTemplate.templateVersionId
          ? continuityCandidate.id
          : undefined;
      const response = await fetch("/api/products/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformAssignmentId: selectedTemplate.platformAssignmentId,
          language,
          outputSize: size,
          backgroundChoice: selectedBackgroundKey,
          productVariantChoice: selectedProductVariantKey,
          assetChoices,
          revisions: selectedRevision ? [selectedRevision] : [],
          replaceContentId: regenerateCurrentDraft ? content.id : undefined,
          replaceContentUpdatedAt: regenerateCurrentDraft ? content.updatedAt : undefined,
          sourceContentId: compatibleCampaignSourceId,
        }),
      });
      const result = await response.json();
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) {
        track("studio_generation_failed", {
          duration_ms: Math.round(performance.now() - generationStartedAt),
          safe_reason_code: "request_failed",
        });
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
        citations: Array.isArray(result.evidence)
          ? (result.evidence as StudioContent["citations"])
          : [],
        templateVersionId: selectedTemplate.templateVersionId ?? null,
        outputSize: (result.outputSize as string | null) ?? size,
        campaignRootContentId:
          (result.campaignRootContentId as string | undefined) ??
          compatibleCampaignSourceId ??
          (result.contentId as string),
        manuallyEdited: false,
        canEdit: true,
        // Subsequent picker/text autosaves use optimistic locking. Reuse the
        // exact server write timestamp rather than a client-side approximation.
        updatedAt:
          typeof result.updatedAt === "string"
            ? result.updatedAt
            : new Date().toISOString(),
      };
      const nextContentSize = nextContent.outputSize ?? size;
      setContentsBySize((current) => ({ ...current, [nextContentSize]: nextContent }));
      // Keep the completed draft available, but do not snap the author back
      // to a stale format or overwrite any state they changed after this
      // request began.
      if (workspaceInteractionSequence.current !== generationInteractionSequence) {
        return;
      }
      setCampaignSourceContentId(nextContent.id);
      setSize(nextContentSize);
      setDraftFields(nextContent.structured_fields);
      setSavedFields(nextContent.structured_fields);
      setSelectedBackgroundOverride(selectedBackgroundKey);
      setSelectedProductVariantOverride(selectedProductVariantKey);
      setSaveState("saved");
      setSavedAt(
        typeof result.updatedAt === "string"
          ? result.updatedAt
          : new Date().toISOString()
      );
      setHasManualEdits(false);
      setSelectedRevision(null);
      setTruncatedFields(
        Array.isArray(result.truncatedFields) ? (result.truncatedFields as string[]) : []
      );
      track("studio_generation_completed", {
        duration_ms: Math.round(performance.now() - generationStartedAt),
        outcome: "success",
        fit_state: Array.isArray(result.truncatedFields) && result.truncatedFields.length > 0 ? "trimmed" : "ready",
        evidence_count: Array.isArray(result.evidence) ? result.evidence.length : 0,
      });
      setShowOriginal(false);
      setReferenceLockedSize(null);
      if (!regenerateCurrentDraft) {
        // Move from /studio/new to the durable content route. A native history
        // update changes the address bar but leaves Server Actions attached to
        // the new-draft route tree, so the next autosave can re-render Studio
        // with the blank template payload.
        router.replace(studioContentUrl(nextContent.id, nextContentSize, returnTo));
      }
    } catch {
      track("studio_generation_failed", {
        duration_ms: Math.round(performance.now() - generationStartedAt),
        safe_reason_code: "network_or_parse_failure",
      });
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
    const exportStartedAt = performance.now();
    const exportType = content?.status === "approved" ? "approved_export" : "draft_or_reference";
    track("export_started", {
      type: exportType,
      format_key: size,
      file_format: exportFormat,
      quality: exportScale,
    });
    setDownloading(true);
    setError(null);
    try {
      if (isBrandReferenceView) {
        const filename = `${selectedProduct.name}-${selectedTemplate.variant}-brand-reference-${size}`
          .replace(/[^\w]+/g, "-")
          .toLowerCase();
        const serverPreviewUrl = new URL(originalExportUrl, window.location.origin);
        serverPreviewUrl.searchParams.set("format", exportFormat);
        serverPreviewUrl.searchParams.set("scale", exportScale);
        serverPreviewUrl.searchParams.set("download", "1");
        await downloadUrl(
          serverPreviewUrl.toString(),
          `${filename}.${exportFormat === "jpeg" ? "jpg" : exportFormat}`
        );
        track("export_completed", {
          type: exportType,
          duration_ms: Math.round(performance.now() - exportStartedAt),
          outcome: "success",
        });
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
        track("export_completed", {
          type: exportType,
          duration_ms: Math.round(performance.now() - exportStartedAt),
          outcome: "success",
        });
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
      track("export_completed", {
        type: exportType,
        duration_ms: Math.round(performance.now() - exportStartedAt),
        outcome: "success",
      });
    } catch {
      track("export_completed", {
        type: exportType,
        duration_ms: Math.round(performance.now() - exportStartedAt),
        outcome: "failed",
      });
      setError("The preview could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  async function submit() {
    if (!content || dirty || hasIssues || hasLayoutOverflow || saveState === "saving") return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitForReview(content.id);
      if ("error" in result) {
        if (result.error.startsWith("Your session expired")) {
          router.push("/login");
          return;
        }
        setError(result.error);
      } else {
        setContentsBySize((current) => {
          const existing = current[size];
          if (!existing || existing.id !== content.id) return current;
          return { ...current, [size]: { ...existing, status: "in_review" } };
        });
        router.refresh();
        track("studio_review_submitted", { format_key: size });
      }
    } catch {
      setError("Review submission was interrupted. Your draft is still saved; try submitting again.");
    } finally {
      setSubmitting(false);
    }
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
    <div className="flex min-h-[100dvh] min-h-0 flex-col bg-page md:h-[100dvh] md:overflow-hidden">
      <header className="flex h-[56px] shrink-0 items-center justify-between gap-3 border-b border-edge bg-surface px-4 md:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Link href={returnTo ?? (content ? "/content" : `/products/${selectedProduct.id}?view=templates`)} className="shrink-0 text-[14px] font-semibold text-ink-muted hover:text-brand">← Back</Link>
          <span className="h-5 w-px shrink-0 bg-edge" aria-hidden="true" />
          <h1 className="sr-only">{studioTitle}</h1>
          <ContextPath items={[{ label: selectedProduct.name, href: `/products/${selectedProduct.id}` }, { label: selectedTemplate.variant }, { label: activeSizeLabel }]} />
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
            <span className="shrink-0 text-[13px] font-semibold text-ink-faint" aria-live="polite">
            {saveState === "saving" ? "Saving changes…" : saveState === "error" ? "Changes not saved" : saveState === "saved" ? "Saved" : selectedProduct.name}
          </span>
        )}
      </header>

      <div
        className="flex min-h-0 flex-1 flex-col-reverse overflow-visible md:grid md:overflow-hidden"
        style={{ gridTemplateColumns: "minmax(340px, 400px) minmax(0, 1fr)" }}
      >
        <aside
          aria-label="Studio controls and review details"
          className="flex min-h-0 flex-col gap-6 overflow-visible border-r border-edge bg-surface px-4 py-6 md:overflow-y-auto md:px-8"
        >
          <a
            href="#studio-preview-stage"
            className="sr-only focus:not-sr-only focus:rounded-[8px] focus:px-3 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-brand focus:ring-2 focus:ring-brand"
          >
            Skip to template preview
          </a>
          <div className="flex flex-col gap-3">
            <span className="text-label text-ink-faint">Product and campaign</span>
            <select
              value={`${selectedProduct.name} · ${selectedTemplate.variant}`}
              disabled
              aria-label="Product and campaign"
              className="h-10 w-full rounded-[8px] border border-edge-strong bg-surface px-3 text-[13px] font-semibold text-ink outline-none disabled:opacity-100"
            >
              <option>{selectedProduct.name} · {selectedTemplate.variant}</option>
            </select>
          </div>

          {mode === "review" && content && (
            <StudioReviewActions contentId={content.id} onReviewed={markReviewed} />
          )}

          {!showOriginal && selectedTemplate.platformManifest && (activeAssetChoiceFields.length > 0 || hasBackgroundOptions) && (
            <section className="flex flex-col gap-4" aria-labelledby="studio-visuals">
              <h2 id="studio-visuals" className="text-label text-ink-faint">Visuals</h2>
              {activeAssetChoiceFields.map((field) => (
              <StudioAssetChoicePicker
                  key={field.key}
                  fieldKey={field.key}
                  label={field.label}
                  options={selectedTemplate.assetChoiceOptionsByField?.[field.key] ?? []}
                  value={String(previewFields[field.key] ?? "")}
                  editable={editable && !busy}
                  onChange={(value) => updateField(field.key, value)}
                />
              ))}
              {hasBackgroundOptions && (
                <StudioBackgroundPicker
                  options={backgroundOptions}
                  value={selectedBackgroundKey}
                  editable={editable && !busy}
                  onChange={(value) => updateField(BACKGROUND_CHOICE_FIELD, value)}
                  assetUrlByPath={platformAssetUrlByPath}
                />
              )}
            </section>
          )}

          {/* What the reviewer asked for has to be readable before the copy it
              applies to. This sat below the Generate button, under the fold at
              1440x900, so an author opening rejected work saw the fields to
              edit and not the instruction telling them what to change. Same
              block, same condition, same content — moved above the editor. */}
          {mode === "edit" && content?.status === "rejected" && content.rejectionNote && (
            <div className="rounded-control border border-reject-border bg-reject-tint px-3 py-2.5">
              <p className="text-[13px] font-bold text-reject">Changes requested</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                {content.rejectionNote}
              </p>
            </div>
          )}

          <section className="flex flex-col gap-4" aria-labelledby="studio-message">
            <h2 id="studio-message" className="text-label text-ink-faint">Message</h2>
            <StudioFields
              fields={activeEditableFields}
              requiredFields={activeRequiredFields}
              values={activeFields}
              limits={activeFieldLimits}
              editable={editable && !busy}
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
              buttonLabel="Generate"
              error={error}
              warning={truncationWarning}
              unavailableRevisions={unavailableRevisions}
              allowedLocales={selectedTemplate.allowedLocales}
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
              buttonLabel="Generate"
              error={error}
              warning={truncationWarning}
              unavailableRevisions={unavailableRevisions}
              allowedLocales={selectedTemplate.allowedLocales}
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
              buttonLabel="Generate"
              error={error}
              warning={truncationWarning}
              unavailableRevisions={unavailableRevisions}
              allowedLocales={selectedTemplate.allowedLocales}
            />
          )}
          </section>

          {mode === "edit" && content && hasManualEdits && (
            <p className="rounded-control border border-warn-border bg-warn-tint px-3 py-2 text-[13px] leading-relaxed text-warn">
              Manual edits are tracked separately from the generated copy and require reviewer
              approval before export.
            </p>
          )}
          {mode === "edit" && content && (
            <div className="flex items-center justify-between rounded-control border border-edge bg-page px-3 py-2" role="status" aria-live="polite">
              <span
                className={`text-[13px] font-semibold ${
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
                <span className="text-[13px] text-ink-faint">
                  {new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </div>
          )}
          {mode === "edit" && content && saveState === "error" && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={copyUnsavedFields}>
                Copy unsaved fields
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
                Refresh Studio
              </Button>
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
            <p className="rounded-control bg-brand-tint px-3 py-2 text-[13px] font-semibold text-brand" role="status">
              Awaiting your review. Editing is paused until it is approved or returned.
            </p>
          )}
          {mode === "review" && content && (
            <StudioReviewSummary
              content={content}
              previousVersion={previousVersion}
              hasFitIssues={hasIssues || hasLayoutOverflow}
            />
          )}
          {mode === "read" && content?.status === "in_review" && (
            <p className="rounded-control bg-brand-tint px-3 py-2 text-[13px] font-semibold text-brand">
              Submitted for review. Editing is paused until it is approved or returned.
            </p>
          )}
          {mode === "read" && content?.status === "approved" && (
            <p className="rounded-control bg-approve-tint px-3 py-2 text-[13px] font-semibold text-approve">
              Approved snapshot. Download is enabled.
            </p>
          )}
          {mode === "read" && content?.status === "rejected" && (
            <p className="rounded-control bg-page px-3 py-2 text-[13px] leading-relaxed text-ink-muted">
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

        <section
          id="studio-preview-stage"
          className="flex min-h-[52dvh] min-w-0 flex-col bg-[#f5f5f2] md:min-h-0"
        >
          <StudioToolbar
            sizes={sizes}
            activeSize={size}
            sizeLabel={(key) =>
              selectedTemplate.platformManifest
                ? getTemplateBundleVariantLabel(selectedTemplate.platformManifest, key)
                : sizeLabel(key)
            }
            sizeDims={(key) =>
              (selectedTemplate.platformManifest
                ? getTemplateBundleVariantDimensions(selectedTemplate.platformManifest, key)
                : knownSizeDimensions(key)) ?? undefined
            }
            onSelectSize={selectSize}
            disabled={busy}
            zoom={previewZoom}
            onZoomChange={setPreviewZoom}
            viewToggle={
              hasAnyGeneratedDraft
                ? {
                    showOriginal: isBrandReferenceView,
                    onShowOriginalChange: (nextShowOriginal) => {
                      setShowOriginal(nextShowOriginal);
                      setReferenceLockedSize(nextShowOriginal ? size : null);
                    },
                  }
                : undefined
            }
          />

          <div className="relative min-h-0 flex-1 overflow-hidden bg-page">
            {busy && <GenerationLoader />}
            {!content && hasAnyGeneratedDraft && !showOriginal ? (
              <MissingDraftFrame
                width={dims.w}
                height={dims.h}
                sizeLabel={activeSizeLabel}
                busy={busy}
                onGenerate={generate}
                onCopyFromCampaign={() => generate(true)}
                zoom={previewZoom}
              />
            ) : content && !isBrandReferenceView && selectedTemplate.platformManifest ? (
              <LiveTemplatePreviewFrame
                manifest={selectedTemplate.platformManifest}
                variantKey={size}
                fields={previewFields}
                assetUrlByPath={platformAssetUrlByPath}
                damAssetUrlById={selectedTemplate.damAssetUrlById}
                textLayoutByField={textLayoutByField}
                width={dims.w}
                height={dims.h}
                updating={saveState === "saving"}
                zoom={previewZoom}
              />
            ) : isBrandReferenceView ? (
              <ServerPreviewFrame
                src={originalPreviewUrl}
                highResolutionSrc={originalExportUrl}
                width={dims.w}
                height={dims.h}
                updating={false}
                zoom={previewZoom}
              />
            ) : (
            <ServerPreviewFrame
                src={content ? previewUrl : originalPreviewUrl}
                width={dims.w}
                height={dims.h}
                updating={false}
                zoom={previewZoom}
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
            isBrandReference={isBrandReferenceView}
          />
        </section>
      </div>
    </div>
  );
}
