"use client";

import { useEffect, useRef, useState } from "react";

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
      className="absolute inset-0 z-20 flex items-center justify-center rounded-card bg-[#141613]/80 p-6 backdrop-blur-[3px]"
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
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateScale = () => {
      const availableWidth = Math.max(1, viewport.clientWidth - 48);
      const availableHeight = Math.max(1, Math.min(760, window.innerHeight - 250));
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
      className="relative flex min-h-[600px] w-full items-center justify-center overflow-hidden rounded-card border border-edge bg-[#1a1d1b] p-6"
    >
      {updating && (
        <div className="absolute right-4 top-4 z-10 rounded-full bg-surface/90 px-3 py-1.5 text-[11px] font-semibold text-ink-muted shadow-sm">
          Updating preview…
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt="Generated template preview"
        className="block shadow-elevated"
        style={{
          width: width * scale,
          height: height * scale,
        }}
      />
    </div>
  );
}
