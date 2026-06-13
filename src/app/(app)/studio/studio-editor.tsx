"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  SIZES,
  BACKGROUNDS,
  DEFAULTS,
  buildRenderUrl,
  type SizeKey,
  type CreativeInput,
} from "@/lib/creative";

const SIZE_ENTRIES = Object.entries(SIZES) as [SizeKey, (typeof SIZES)[SizeKey]][];
const BG_ENTRIES = Object.entries(BACKGROUNDS);

function Field({
  label,
  value,
  onChange,
  placeholder,
  note,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  note?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-control border border-edge-strong bg-surface px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand"
      />
      {note && <span className="text-[11px] text-ink-faint">{note}</span>}
    </label>
  );
}

export function StudioEditor({
  contentId,
  contentTitle,
  orgName,
  lines,
}: {
  contentId: string;
  contentTitle: string;
  orgName: string;
  lines: string[];
}) {
  const [input, setInput] = useState<CreativeInput>({
    ...DEFAULTS,
    org: orgName,
    headline: lines[0] ?? contentTitle,
    cta: lines[1] ?? "",
    approved: true,
  });
  const [downloading, setDownloading] = useState(false);

  function set<K extends keyof CreativeInput>(key: K, value: CreativeInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  const renderUrl = useMemo(() => buildRenderUrl(input), [input]);
  const size = SIZES[input.size];
  const previewRatio = size.w / size.h;

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch(renderUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${input.size}-${input.bg}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Provenance banner — the words come from approved content */}
      <div className="flex items-center gap-2.5 rounded-control border border-approve-border bg-approve-tint px-4 py-2.5">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-approve text-[11px] font-bold text-white">
          ✓
        </span>
        <span className="text-[13px] text-ink-muted">
          Text is drawn from your approved piece,{" "}
          <Link
            href={`/content/${contentId}`}
            className="font-semibold text-approve hover:underline"
          >
            {contentTitle}
          </Link>
          .
        </span>
      </div>

      <div className="grid grid-cols-[1fr_1.05fr] items-start gap-6">
        {/* Controls */}
        <div className="flex flex-col gap-5 rounded-card border border-edge bg-surface p-6">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold">Size</span>
            <div className="flex flex-wrap gap-2">
              {SIZE_ENTRIES.map(([key, s]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set("size", key)}
                  className={`flex flex-col items-start rounded-control border px-3 py-2 text-left transition-colors ${
                    input.size === key
                      ? "border-brand bg-brand-tint"
                      : "border-edge-strong hover:border-brand"
                  }`}
                >
                  <span className="text-[12.5px] font-semibold">{s.label}</span>
                  <span className="text-[10.5px] text-ink-faint">
                    {s.channel} · {s.w}×{s.h}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold">Background</span>
            <div className="flex gap-2.5">
              {BG_ENTRIES.map(([key, b]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set("bg", key)}
                  title={b.label}
                  className={`h-9 w-9 rounded-full border-2 transition-transform ${
                    input.bg === key ? "border-brand" : "border-transparent"
                  }`}
                  style={{
                    backgroundImage: `linear-gradient(145deg, ${b.from}, ${b.to})`,
                  }}
                />
              ))}
            </div>
          </div>

          {lines.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">
                Pull a line from your approved copy
              </span>
              <select
                onChange={(e) => e.target.value && set("headline", e.target.value)}
                value=""
                className="rounded-control border border-edge-strong bg-surface px-3 py-2.5 text-[13.5px] outline-none focus:border-brand"
              >
                <option value="">Choose a line to use as the headline…</option>
                {lines.map((line, i) => (
                  <option key={i} value={line}>
                    {line}
                  </option>
                ))}
              </select>
            </label>
          )}

          <Field label="Brand name" value={input.org} onChange={(v) => set("org", v)} />
          <Field
            label="Headline"
            value={input.headline}
            onChange={(v) => set("headline", v)}
            note="From your approved content. Edit lightly for fit, don't add new claims."
          />
          <Field
            label="Supporting line"
            value={input.cta}
            onChange={(v) => set("cta", v)}
            placeholder="Optional second line"
          />
          <Field
            label="Product image URL"
            value={input.img}
            onChange={(v) => set("img", v)}
            placeholder="https://…  (optional)"
          />
        </div>

        {/* Preview */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center rounded-card border border-edge bg-page p-5">
            <div
              className="overflow-hidden rounded-[10px] shadow-lg"
              style={{
                width: previewRatio >= 1 ? "100%" : "auto",
                height: previewRatio >= 1 ? "auto" : "440px",
                aspectRatio: `${size.w} / ${size.h}`,
                maxWidth: "100%",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={renderUrl}
                alt="Creative preview"
                className="h-full w-full object-contain"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={download}
              disabled={downloading}
              className="rounded-control bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {downloading ? "Preparing…" : `Download PNG · ${size.label}`}
            </button>
            <a
              href={renderUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-control border border-edge-strong px-[18px] py-2.5 text-[13.5px] font-semibold text-ink-muted transition-colors hover:border-brand"
            >
              Open full size
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
