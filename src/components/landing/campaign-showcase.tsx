"use client";

import { useState } from "react";

/*
 * Schematic illustration for the landing page: one approved campaign reflowing
 * across formats. Deliberately diagrammatic — it is NOT a screenshot of Studio
 * and must never be presented as live output. The card copy is illustrative
 * placeholder marketing, not a real product claim.
 *
 * Deliberately does not demo localization. Language is not a headline feature
 * on this page — see docs/LANDING_MEDIA_SPEC.md.
 */

type Size = {
  id: string;
  label: string;
  dims: string;
  /** CSS aspect-ratio value for the schematic frame. */
  ratio: string;
  /** Tailwind max-width so tall formats stay inside the column. */
  frameWidth: string;
};

const SIZES: Size[] = [
  {
    id: "square",
    label: "Social post",
    dims: "1080 × 1080",
    ratio: "1 / 1",
    frameWidth: "max-w-[400px]",
  },
  {
    id: "story",
    label: "Story",
    dims: "1080 × 1920",
    ratio: "9 / 16",
    frameWidth: "max-w-[260px]",
  },
  {
    id: "flyer",
    label: "A4 flyer",
    dims: "210 × 297 mm",
    ratio: "210 / 297",
    frameWidth: "max-w-[320px]",
  },
  {
    id: "banner",
    label: "Link post",
    dims: "1200 × 627",
    ratio: "1200 / 627",
    frameWidth: "max-w-[440px]",
  },
];

const HELD = [
  {
    term: "The layout",
    detail:
      "Geometry, type scale, safe areas. Set by the template, not by whoever happened to make this.",
  },
  {
    term: "The claim",
    detail:
      "Every line traces back, word for word, to a source you signed off.",
  },
  {
    term: "The approval",
    detail:
      "A named person released this exact revision. That record does not move.",
  },
];

// No focus ring here: the global `:focus-visible` outline in globals.css
// handles it, and an `outline-none` would suppress it.
const pillBase =
  "rounded-control border px-3 py-1.5 text-[13px] font-semibold transition-colors";
const pillOn = "border-brand bg-brand/15 text-brand-on-dark";
const pillOff =
  "border-white/15 text-sidebar-text hover:border-white/35 hover:text-white";

export function CampaignShowcase() {
  const [sizeId, setSizeId] = useState(SIZES[0].id);
  const size = SIZES.find((s) => s.id === sizeId) ?? SIZES[0];

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-14">
      <div className="flex flex-col gap-8">
        <fieldset className="flex flex-col gap-3 border-0 p-0">
          <legend className="text-label text-sidebar-text">
            Pick a format
          </legend>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === sizeId}
                onClick={() => setSizeId(s.id)}
                className={`${pillBase} ${s.id === sizeId ? pillOn : pillOff}`}
              >
                {s.label}{" "}
                <span className="font-normal opacity-70">{s.dims}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-4 rounded-card border border-white/10 bg-white/[0.03] p-5">
          <p className="text-label text-brand-on-dark">
            Three things that never move
          </p>
          <ul className="flex flex-col gap-2.5 text-prose text-sidebar-text">
            {HELD.map((item) => (
              <li key={item.term}>
                <span className="font-semibold text-white">{item.term}.</span>{" "}
                {item.detail}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div
          aria-live="polite"
          className={`w-full ${size.frameWidth} overflow-hidden rounded-card border border-white/15 bg-surface shadow-elevated`}
          style={{ aspectRatio: size.ratio }}
        >
          <div className="flex h-full flex-col justify-between gap-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-[6px] bg-brand-dark text-[11px] font-extrabold leading-none text-white">
                  B
                </span>
                <span className="text-caption font-bold tracking-[-0.02em] text-ink">
                  YOUR BRAND
                </span>
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-approve-tint px-2 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-approve" />
                {/* accent-dark (#00756e), not approve: the approve token on this tint
 measured 3.98:1 before 29c5e2a darkened the palette. */}
                <span className="text-caption font-semibold leading-none text-accent-dark">
                  Approved
                </span>
              </span>
            </div>

            <div className="flex flex-1 flex-col justify-center gap-2">
              <p className="text-h1 text-balance text-ink">
                Approved for your market.
              </p>
              <p className="text-caption text-pretty text-ink-muted-strong">
                Same claim, same evidence, whoever made it.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="rounded-control bg-brand-dark px-3 py-1.5 text-caption font-semibold text-white">
                Learn more
              </span>
              <span className="text-caption leading-none text-ink-muted-strong">
                {size.dims}
              </span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[440px] rounded-card border border-white/10 bg-white/[0.03] p-4">
          <p className="text-label text-brand-on-dark">Evidence attached</p>
          <p className="mt-2 text-caption text-sidebar-text">
            Cited to{" "}
            <span className="font-semibold text-white">
              Product data sheet, rev. 4
            </span>
            . The server checked that excerpt against the approved document word
            for word — and checks it again at submit, approve, and export.
          </p>
        </div>

        <p className="text-caption text-sidebar-text">
          Schematic illustration, not live output.
        </p>
      </div>
    </div>
  );
}
