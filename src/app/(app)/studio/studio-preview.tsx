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
  const imageFailed = failedSrc === src;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateScale = () => {
      const availableWidth = Math.max(1, viewport.clientWidth - 48);
      const availableHeight = Math.max(1, Math.min(900, window.innerHeight - 220));
      setScale(Math.min(1, availableWidth / width, availableHeight / height));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [height, width]);

  return (
    <div
      ref={viewportRef}
      className="relative flex w-full items-center justify-center overflow-auto rounded-card border border-edge bg-page p-4 sm:p-6"
      style={{
        minHeight: Math.round(Math.max(220, height * scale + 48)),
      }}
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
          key={src}
          src={src}
          alt="Generated template preview"
          className="block rounded-[3px] shadow-elevated"
          onError={() => setFailedSrc(src)}
          style={{
            width: width * scale,
            height: height * scale,
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
      const availableWidth = Math.max(1, viewport.clientWidth - 48);
      const availableHeight = Math.max(1, Math.min(900, window.innerHeight - 220));
      setScale(Math.min(1, availableWidth / width, availableHeight / height));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [height, width]);

  return (
    <div
      ref={viewportRef}
      className="relative flex w-full items-center justify-center overflow-auto rounded-card border border-edge bg-page p-4 sm:p-6"
      style={{
        minHeight: Math.round(Math.max(220, height * scale + 48)),
      }}
    >
      <div
        className="flex flex-col items-center justify-center rounded-[3px] border border-dashed border-edge-strong bg-surface px-6 py-8 text-center shadow-sm"
        style={{
          width: width * scale,
          minHeight: Math.max(220, height * scale),
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
  textLayoutByField,
  width,
  height,
  updating,
}: {
  manifest: TemplateBundleManifest;
  variantKey: string;
  fields: Record<string, unknown>;
  /** Debounced, server-resolved {fontSize, lines} per field (see
   * checkDraftStructuredFieldsFit in content/actions.ts). Undefined until
   * the first resolution lands — falls back to raw-text CSS wrap at the
   * authored size for that brief window, then upgrades in place. */
  textLayoutByField?: Record<string, TemplateBundleTextLayout>;
  width: number;
  height: number;
  updating: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.72);
  const rendered = renderTemplateBundleVariant({
    manifest,
    variantKey,
    fields,
    textLayoutByField,
  });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateScale = () => {
      const availableWidth = Math.max(1, viewport.clientWidth - 48);
      const availableHeight = Math.max(1, Math.min(900, window.innerHeight - 220));
      setScale(Math.min(1, availableWidth / width, availableHeight / height));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [height, width]);

  if (!rendered) {
    return (
      <ServerPreviewFrame
        src=""
        width={width}
        height={height}
        updating={updating}
      />
    );
  }

  return (
    <div
      ref={viewportRef}
      className="relative flex w-full items-center justify-center overflow-auto rounded-card border border-edge bg-page p-4 sm:p-6"
      style={{
        minHeight: Math.round(Math.max(220, height * scale + 48)),
      }}
    >
      {updating && (
        <div className="absolute right-4 top-4 z-10 rounded-full bg-surface/90 px-3 py-1.5 text-[11px] font-semibold text-ink-muted shadow-sm">
          Saving…
        </div>
      )}
      <div
        className="rounded-[3px] shadow-elevated"
        style={{
          width: width * scale,
          height: height * scale,
        }}
      >
        <div
          style={{
            width,
            height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {rendered.element}
        </div>
      </div>
    </div>
  );
}
