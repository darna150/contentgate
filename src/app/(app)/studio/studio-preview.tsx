"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PREVIEW_VIEWPORT_PADDING,
  previewFitScale,
  previewOverlayScale,
  resolvePreviewScale,
  type PreviewZoom,
} from "@/lib/studio-preview-scale";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import {
  renderTemplateBundleVariant,
  type TemplateBundleTextLayout,
} from "@/lib/template-platform/render";

const GENERATION_MESSAGES = [
  "Giving every word a job…",
  "Checking the claim before it gets the spotlight…",
  "Making the layout earn each line break…",
  "Turning source material into something worth approving…",
] as const;

// FontFace instances live for the lifetime of the browser document. Reusing
// them avoids a new signed-storage font request every time the user changes a
// size, product colour, or background in Studio.
const previewFontLoads = new Map<string, Promise<void>>();

function previewFontLoadKey(
  manifest: TemplateBundleManifest,
  font: TemplateBundleManifest["fonts"][number]
) {
  return [manifest.family.key, manifest.version.name, font.asset, font.family, font.weight, font.style].join(":");
}

function loadPreviewFont(input: {
  manifest: TemplateBundleManifest;
  font: TemplateBundleManifest["fonts"][number];
  src: string;
}) {
  const key = previewFontLoadKey(input.manifest, input.font);
  const existing = previewFontLoads.get(key);
  if (existing) return existing;

  const pending = new FontFace(input.font.family, `url(${input.src})`, {
    weight: String(input.font.weight),
    style: input.font.style,
  })
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
    })
    .catch((error) => {
      // A short-lived signed URL must not poison future attempts after a
      // refresh or a later size switch obtains a fresh URL.
      previewFontLoads.delete(key);
      throw error;
    });
  previewFontLoads.set(key, pending);
  return pending;
}

/**
 * Single source of truth for preview sizing across all three frames (server
 * image, missing-draft placeholder, live editable canvas). Previously each one
 * carried its own copy of this effect, which let them drift.
 */
function usePreviewScale(input: {
  width: number;
  height: number;
  zoom: PreviewZoom;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.72);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateFit = () => {
      setFitScale(
        previewFitScale({
          availableWidth: Math.max(1, viewport.clientWidth - PREVIEW_VIEWPORT_PADDING),
          availableHeight: Math.max(1, viewport.clientHeight - PREVIEW_VIEWPORT_PADDING),
          width: input.width,
          height: input.height,
        })
      );
    };
    updateFit();
    const observer = new ResizeObserver(updateFit);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [input.height, input.width]);

  const { scale, overflows } = resolvePreviewScale({
    zoom: input.zoom,
    fitScale,
    width: input.width,
  });
  return { viewportRef, scale, overflows };
}

/**
 * Scrollable, centred preview stage.
 *
 * Overlays (status badges, loading states) are siblings of the scroll container
 * rather than children, so they stay pinned instead of scrolling away with the
 * artwork. The inner `w-max min-w-full` wrapper keeps the artwork centred when
 * it fits and prevents flexbox from clipping the leading edge when it does not
 * — plain `justify-center` makes overflow on that side unreachable by scroll.
 */
function PreviewStage({
  viewportRef,
  overlay,
  children,
  overflows,
  ...rest
}: {
  viewportRef: RefObject<HTMLDivElement | null>;
  overlay?: ReactNode;
  children: ReactNode;
  overflows: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="relative h-full min-h-0 w-full bg-[#f5f5f2]" {...rest}>
      {overlay}
      <div
        ref={viewportRef}
        className={cn("h-full w-full", overflows ? "overflow-auto" : "overflow-hidden")}
      >
        <div className="flex min-h-full w-max min-w-full items-center justify-center p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function highDensityPreviewSrc(src: string) {
  const makeScaledApiUrl = (value: string) => {
    const base =
      typeof window === "undefined" ? "http://contentgate.local" : window.location.origin;
    const url = new URL(value, base);
    url.searchParams.set("scale", "2");
    return value.startsWith("http") ? url.toString() : url.pathname + url.search + url.hash;
  };

  if (src.includes("/api/creative/")) return makeScaledApiUrl(src);
  if (!src.startsWith("/")) return src;
  const [pathname, query = ""] = src.split("?");
  if (
    /\/template-(bundles|packages)\/contentgate\//.test(pathname) &&
    pathname.toLowerCase().endsWith(".png")
  ) {
    return `${pathname.replace(/\.png$/i, "@2x.png")}${query ? `?${query}` : ""}`;
  }
  return src;
}

export function GenerationLoader() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMessageIndex(
        (current) => (current + 1) % GENERATION_MESSAGES.length
      );
    }, 1800);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center rounded-card bg-ink/80 p-6 backdrop-blur-[3px]"
      role="status"
      aria-live="polite"
      aria-label="Generating preview"
    >
      <div className="flex w-full max-w-[360px] flex-col items-center gap-4 rounded-card border border-edge bg-surface px-7 py-6 text-center shadow-elevated">
        <div className="relative flex h-12 w-12 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand/15 motion-reduce:animate-none" />
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-brand text-xl text-white">
            ✦
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[14px] font-bold text-ink">Making the case, not just the copy</p>
          <p className="min-h-5 text-[13px] text-ink-muted">
            {GENERATION_MESSAGES[messageIndex]}
          </p>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand motion-reduce:animate-none"
              style={{ animationDelay: `${dot * 140}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ServerPreviewFrame({
  src,
  width,
  height,
  updating,
  zoom = "fit",
}: {
  src: string;
  width: number;
  height: number;
  updating: boolean;
  zoom?: PreviewZoom;
}) {
  const { viewportRef, scale, overflows } = usePreviewScale({ width, height, zoom });
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const displaySrc = highDensityPreviewSrc(src);
  const [loadedSrc, setLoadedSrc] = useState(displaySrc);
  const [loadingNext, setLoadingNext] = useState(false);
  const imageFailed = failedSrc === displaySrc;

  // Decode the next reference off-screen and keep the previous one in place
  // until it is paint-ready. Size changes therefore never expose a blank or
  // half-loaded canvas, even on a cold 2× Figma export.
  useEffect(() => {
    if (displaySrc === loadedSrc) return;
    let cancelled = false;
    const image = new Image();
    queueMicrotask(() => {
      if (!cancelled) setLoadingNext(true);
    });
    const reveal = () => {
      if (cancelled) return;
      setLoadedSrc(displaySrc);
      setLoadingNext(false);
      setFailedSrc(null);
    };
    image.onload = () => {
      const decode = image.decode ? image.decode() : Promise.resolve();
      void decode.catch(() => undefined).then(reveal);
    };
    image.onerror = () => {
      if (!cancelled) {
        setFailedSrc(displaySrc);
        setLoadingNext(false);
      }
    };
    image.src = displaySrc;
    return () => {
      cancelled = true;
    };
  }, [displaySrc, loadedSrc]);

  return (
    <PreviewStage
      viewportRef={viewportRef}
      overflows={overflows}
      overlay={
        (updating || loadingNext) && (
          <div className="absolute right-4 top-4 z-10 rounded-full bg-surface/90 px-3 py-1.5 text-[11px] font-semibold text-ink-muted shadow-sm">
            {loadingNext ? "Loading reference…" : "Updating preview…"}
          </div>
        )
      }
    >
      {imageFailed ? (
        <div className="flex max-w-[420px] flex-col items-center gap-3 rounded-card border border-edge bg-surface px-7 py-6 text-center shadow-elevated">
          <div className="flex size-11 items-center justify-center rounded-full bg-brand-tint text-[18px] text-brand">
            !
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-[14px] font-bold text-ink">Preview unavailable</p>
            <p className="text-[12.5px] leading-5 text-ink-muted">
              This draft preview could not be loaded. Refresh Studio, then
              generate the size again if the draft was reset.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-1 rounded-control bg-brand px-4 py-2 text-[12px] font-semibold text-white hover:bg-brand-dark"
          >
            Refresh Studio
          </button>
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={loadedSrc}
          src={loadedSrc}
          alt="Generated template preview"
          className="block rounded-[3px] shadow-elevated"
          onError={() => setFailedSrc(displaySrc)}
          style={{
            width: Math.round(width * scale),
            height: Math.round(height * scale),
          }}
        />
      )}
    </PreviewStage>
  );
}

export function MissingDraftFrame({
  width,
  height,
  sizeLabel,
  busy,
  onGenerate,
  onCopyFromCampaign,
  zoom = "fit",
}: {
  width: number;
  height: number;
  sizeLabel: string;
  busy: boolean;
  onGenerate: () => void;
  onCopyFromCampaign: () => void;
  zoom?: PreviewZoom;
}) {
  const { viewportRef, scale, overflows } = usePreviewScale({ width, height, zoom });

  return (
    <PreviewStage viewportRef={viewportRef} overflows={overflows}>
      <div
        className="flex flex-col items-center justify-center rounded-[3px] border border-dashed border-edge-strong bg-surface px-6 py-8 text-center shadow-sm"
        style={{
          width: Math.round(width * scale),
          height: Math.round(height * scale),
        }}
      >
        <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-brand-tint text-[18px] font-bold text-brand">
          +
        </div>
        <p className="text-[15px] font-bold text-ink">No draft for {sizeLabel} yet</p>
        <p className="mt-2 max-w-[360px] text-[12.5px] leading-5 text-ink-muted">
          This size needs its own fitted copy and approved snapshot. Generate it
          here instead of reusing another format&apos;s layout.
        </p>
        <Button type="button" onClick={onGenerate} disabled={busy} className="mt-4">
          {busy ? "Generating…" : `Generate ${sizeLabel} draft`}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCopyFromCampaign}
          disabled={busy}
          className="mt-2"
        >
          Copy from campaign
        </Button>
      </div>
    </PreviewStage>
  );
}

export function LiveTemplatePreviewFrame({
  manifest,
  variantKey,
  fields,
  assetUrlByPath,
  damAssetUrlById,
  textLayoutByField,
  width,
  height,
  updating,
  original = false,
  zoom = "fit",
}: {
  manifest: TemplateBundleManifest;
  variantKey: string;
  fields: Record<string, unknown>;
  /** Signed storage URLs per manifest asset path, so background/product images
   * resolve for platform bundles served from Supabase storage (not public
   * files). Without it the renderer falls back to broken relative paths. */
  assetUrlByPath?: Record<string, string>;
  damAssetUrlById?: Record<string, string>;
  /** Debounced, server-resolved {fontSize, lines} per field (see
   * checkDraftStructuredFieldsFit in content/actions.ts). Undefined until
   * the first resolution lands — uses a conservative local shrink estimate
   * for that brief window, then upgrades in place. */
  textLayoutByField?: Record<string, TemplateBundleTextLayout>;
  width: number;
  height: number;
  updating: boolean;
  original?: boolean;
  zoom?: PreviewZoom;
}) {
  const { viewportRef, scale, overflows } = usePreviewScale({ width, height, zoom });
  const [fontsReady, setFontsReady] = useState(false);
  const renderScale = 2;
  const rendered = renderTemplateBundleVariant({
    manifest,
    variantKey,
    fields,
    assetUrlByPath,
    damAssetUrlById,
    textLayoutByField,
    scale: renderScale,
    original,
  });

  // The editable canvas must use the same embedded font files as the fit
  // service and ImageResponse export. A CSS family name by itself falls back
  // to the operating-system font on most machines, which makes a measured
  // line wrap differently from both Figma and the PNG export.
  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) setFontsReady(false);
    });
    const variant = manifest.variants.find((item) => item.key === variantKey);
    const usedFontKeys = new Set(
      variant?.slots.flatMap((slot) => (slot.kind === "text" ? [slot.fontKey] : [])) ?? []
    );
    const bundleFonts = manifest.fonts
      .filter((font) => usedFontKeys.size === 0 || usedFontKeys.has(font.key))
      .map((font) => {
        const assetPath = manifest.assets.find((asset) => asset.key === font.asset)?.path;
        return { font, src: assetPath ? assetUrlByPath?.[assetPath] : undefined };
      })
      .filter((item): item is { font: TemplateBundleManifest["fonts"][number]; src: string } => Boolean(item.src));
    if (!bundleFonts.length || typeof FontFace === "undefined") {
      queueMicrotask(() => {
        if (!disposed) setFontsReady(true);
      });
      return;
    }
    void Promise.all(
      bundleFonts.map(({ font, src }) => loadPreviewFont({ manifest, font, src }))
    )
      .catch(() => {
        // Keep the canvas available if a signed asset has just expired. The
        // subsequent render/fit request will refresh the signed URL.
      })
      .finally(() => {
        if (!disposed) setFontsReady(true);
      });
    return () => {
      disposed = true;
    };
  }, [assetUrlByPath, manifest, variantKey]);

  if (!rendered) {
    return (
      <div className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-[#f5f5f2] p-4">
        <div className="flex max-w-[420px] flex-col items-center gap-3 rounded-card border border-edge bg-surface px-7 py-6 text-center shadow-elevated">
          <div className="flex size-11 items-center justify-center rounded-full bg-brand-tint text-[18px] text-brand">
            !
          </div>
          <div className="flex flex-col gap-1.5">
          <p className="text-[14px] font-bold text-ink">Template preview unavailable</p>
            <p className="text-[12.5px] leading-5 text-ink-muted">
              This template size could not render locally. Switch sizes or refresh Studio.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PreviewStage
      viewportRef={viewportRef}
      overflows={overflows}
      aria-busy={!fontsReady}
      overlay={
        <>
          {!fontsReady && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#f5f5f2]/90 text-center"
              role="status"
              aria-live="polite"
            >
              <span className="size-7 animate-spin rounded-full border-2 border-brand/25 border-t-brand motion-reduce:animate-none" aria-hidden="true" />
              <p className="text-[12.5px] font-semibold text-ink-muted">Loading locked preview…</p>
            </div>
          )}
          {updating && (
            <div className="absolute right-4 top-4 z-10 rounded-full bg-surface/90 px-3 py-1.5 text-[11px] font-semibold text-ink-muted shadow-sm">
              Saving…
            </div>
          )}
        </>
      }
    >
      <div
        className="rounded-[3px] shadow-elevated"
        style={{
          width: Math.round(width * scale),
          height: Math.round(height * scale),
        }}
      >
        <div
          style={{
            width: rendered.width,
            height: rendered.height,
            // Composed with the outer box this lands on exactly the same pixel
            // width; studio-preview-scale.test.ts guards that identity.
            transform: `scale(${previewOverlayScale(scale, renderScale)})`,
            transformOrigin: "top left",
            // Do not flash a system-font layout before the bundle fonts are
            // present; the explicit loading state above keeps this from
            // looking like an empty or broken preview.
            visibility: fontsReady ? "visible" : "hidden",
          }}
        >
          {rendered.element}
        </div>
      </div>
    </PreviewStage>
  );
}
