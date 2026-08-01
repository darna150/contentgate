"use client";

import { Lock, Pencil } from "lucide-react";
import { useState } from "react";

/*
 * Coded micro-demo for the landing page: the declared fields beside the
 * artefact they produce, and the artefact reflowing across formats.
 *
 * The fields panel is the point. Showing the short list of what opens — and
 * the longer list of what does not — communicates "locked template" far
 * better than a sentence claiming it. Same move as Frontify's Variables
 * panel; see docs/LANDING_MEDIA_SPEC.md.
 *
 * Schematic illustration, NOT live output and not a screenshot of Studio.
 * Card copy is illustrative placeholder marketing, not a real product claim.
 *
 * Deliberately does not demo localization. Language is not a headline feature
 * on this page — keep it that way.
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
    frameWidth: "max-w-[380px]",
  },
  {
    id: "story",
    label: "Story",
    dims: "1080 × 1920",
    ratio: "9 / 16",
    frameWidth: "max-w-[250px]",
  },
  {
    id: "flyer",
    label: "A4 flyer",
    dims: "210 × 297 mm",
    ratio: "210 / 297",
    frameWidth: "max-w-[310px]",
  },
  {
    id: "banner",
    label: "Link post",
    dims: "1200 × 627",
    ratio: "1200 / 627",
    frameWidth: "max-w-[430px]",
  },
];

const OPEN_FIELDS = [
  { name: "Headline", value: "Approved for your market." },
  { name: "Subhead", value: "Same claim, same evidence…" },
  { name: "Offer", value: "—" },
  { name: "Image", value: "From approved library" },
  { name: "Call to action", value: "Learn more" },
];

const LOCKED_FIELDS = [
  "Layout & geometry",
  "Type scale",
  "Safe areas",
  "Logo placement",
  "Colour",
];

const pillBase =
  "rounded-control border px-3 py-1.5 text-[13px] font-semibold transition-colors";
const pillOn = "border-brand bg-brand/15 text-brand-on-dark";
const pillOff =
  "border-white/15 text-sidebar-text hover:border-white/35 hover:text-white";

export function CampaignShowcase() {
  const [sizeId, setSizeId] = useState(SIZES[0].id);
  const size = SIZES.find((s) => s.id === sizeId) ?? SIZES[0];

  return (
    <div className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-3 border-0 p-0">
        <legend className="text-label text-sidebar-text">Pick a format</legend>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === sizeId}
              onClick={() => setSizeId(s.id)}
              className={`${pillBase} ${s.id === sizeId ? pillOn : pillOff}`}
            >
              {s.label} <span className="font-normal opacity-70">{s.dims}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
        {/* Declared fields — the constraint, made visible */}
        <div className="rounded-card border border-white/10 bg-white/[0.03]">
          <div className="flex flex-col gap-3 p-5">
            <p className="text-label text-brand-on-dark">
              What the local team fills in
            </p>
            <ul className="flex flex-col gap-2">
              {OPEN_FIELDS.map((field) => (
                <li
                  key={field.name}
                  className="flex items-center gap-3 rounded-control border border-white/15 bg-brand-dark px-3 py-2.5"
                >
                  <Pencil
                    className="h-3.5 w-3.5 shrink-0 text-brand-on-dark"
                    aria-hidden="true"
                  />
                  <span className="text-caption font-semibold text-white">
                    {field.name}
                  </span>
                  <span className="ml-auto truncate text-caption text-sidebar-text">
                    {field.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 p-5">
            <p className="text-label text-sidebar-text">
              What they cannot touch
            </p>
            <ul className="flex flex-wrap gap-2">
              {LOCKED_FIELDS.map((field) => (
                <li
                  key={field}
                  className="flex items-center gap-1.5 rounded-control border border-white/10 px-2.5 py-1.5 text-caption text-sidebar-text"
                >
                  <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {field}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* The artefact those fields produce */}
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

          <p className="text-caption text-sidebar-text">
            Schematic illustration, not live output.
          </p>
        </div>
      </div>
    </div>
  );
}
