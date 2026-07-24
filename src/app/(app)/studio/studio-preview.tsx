"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { TemplateBundleManifest } from "@/lib/template-platform/manifest";
import {
  renderTemplateBundleVariant,
  type TemplateBundleTextLayout,
} from "@/lib/template-platform/render";

const GENERATION_MESSAGES = [
  "Reading the approved brief.",
  "Balancing the headline and layout.",
  "Keeping every pixel inside the brand system.",
  "Checking copy against the source material.",
  "Polishing the preview for its close-up.",
] as const;

function previewScale(input: {
  availableWidth: number;
  availableHeight: number;
  width: number;
  height: number;
}) {
  const raw = Math.min(
    1,
    input.availableWidth / input.width,
    input.availableHeight / input.height
  );
  // Snap the displayed frame to whole CSS pixels. Fractional image sizes make
  // raster-locked Figma exports (logos, texture, baked layout) look soft while
  // overlaid live text remains crisp.
  const displayedWidth = Math.max(1, Math.floor(input.width * raw));
  return displayedWidth / input.width;
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
          <p className="text-[14px] font-bold text-ink">Building your preview</p>
          <p className="min-h-5 text-[12.5px] text-ink-muted">
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
}: {
  src: string;
  width: number;
  height: number;
  updating: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.72);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const displaySrc = highDensityPreviewSrc(src);
  const imageFailed = failedSrc === displaySrc;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateScale = () => {
      const availableWidth = Math.max(1, viewport.clientWidth - 32);
      const availableHeight = Math.max(1, viewport.clientHeight - 32);
      setScale(previewScale({ availableWidth, availableHeight, width, height }));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [height, width]);

  return (
    <div
      ref={viewportRef}
      className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-[#f5f5f2] p-4"
    >
      {updating && (
        <div className="absolute right-4 top-4 z-10 rounded-full bg-surface/90 px-3 py-1.5 text-[11px] font-semibold text-ink-muted shadow-sm">
          Updating preview…
        </div>
      )}
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
          key={displaySrc}
          src={displaySrc}
          alt="Generated template preview"
          className="block rounded-[3px] shadow-elevated"
          onError={() => setFailedSrc(displaySrc)}
          style={{
            width: Math.round(width * scale),
            height: Math.round(height * scale),
          }}
        />
      )}
    </div>
  );
}

export function MissingDraftFrame({
  width,
  height,
  sizeLabel,
  busy,
  onGenerate,
}: {
  width: number;
  height: number;
  sizeLabel: string;
  busy: boolean;
  onGenerate: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.72);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateScale = () => {
      const availableWidth = Math.max(1, viewport.clientWidth - 32);
      const availableHeight = Math.max(1, viewport.clientHeight - 32);
      setScale(previewScale({ availableWidth, availableHeight, width, height }));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [height, width]);

  return (
    <div
      ref={viewportRef}
      className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-[#f5f5f2] p-4"
    >
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
      </div>
    </div>
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
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.72);
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

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateScale = () => {
      const availableWidth = Math.max(1, viewport.clientWidth - 32);
      const availableHeight = Math.max(1, viewport.clientHeight - 32);
      setScale(previewScale({ availableWidth, availableHeight, width, height }));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [height, width]);

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
    <div
      ref={viewportRef}
      className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-[#f5f5f2] p-4"
    >
      {updating && (
        <div className="absolute right-4 top-4 z-10 rounded-full bg-surface/90 px-3 py-1.5 text-[11px] font-semibold text-ink-muted shadow-sm">
          Saving…
        </div>
      )}
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
            transform: `scale(${scale / renderScale})`,
            transformOrigin: "top left",
          }}
        >
          {rendered.element}
        </div>
      </div>
    </div>
  );
}
