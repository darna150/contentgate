"use client";

import { useEffect, useRef } from "react";

/*
 * The page's centrepiece: one asset, pinned, scrubbed through its entire
 * lifecycle as you scroll. Replaces the old showcase + citation cards, which
 * were the generic "grid of bordered boxes" pattern — adding motion to cards
 * does not stop them being cards.
 *
 * Structure follows the Apple product-page model rather than a section stack:
 * a tall wrapper, a sticky full-height stage, and a single artefact that
 * transforms continuously while the copy beats move past it.
 *
 * Two deliberate engineering choices:
 *
 * 1. NO REACT STATE. The scrubber writes styles imperatively from a rAF-
 *    throttled scroll handler. Re-rendering React on every scroll frame would
 *    be both slower and pointless, and it keeps the component free of the
 *    setState-in-effect cascade.
 *
 * 2. THE MARKUP IS THE FALLBACK. Everything renders in normal flow, fully
 *    visible and readable, as a plain vertical sequence. The effect adds
 *    `data-story="on"`, and only then does CSS switch to the pinned layout. No
 *    JS, no sticky, no hidden content — just a longer readable page. Same for
 *    prefers-reduced-motion, which never opts in.
 *
 * Schematic illustration throughout. Not live output, not a screenshot of
 * Studio, and the wording is illustrative rather than a real product claim.
 */

type Beat = {
  kicker: string;
  line: string;
};

const BEATS: Beat[] = [
  {
    kicker: "Friday, a branch office",
    line: "Someone who was never hired to do marketing needs a flyer by Monday.",
  },
  {
    kicker: "They fill in",
    line: "The only part they know better than headquarters — their customer, their offer.",
  },
  {
    kicker: "The system checks",
    line: "Every claim has to quote an approved source, word for word.",
  },
  {
    kicker: "A named person releases it",
    line: "One exact revision. Nothing else will export.",
  },
  {
    kicker: "It becomes every size",
    line: "Same campaign, same claim, every format the channel asks for.",
  },
  {
    kicker: "Then somebody edits one approved word",
    line: "And it drops straight back to draft. The export shuts.",
  },
];

/** Aspect ratios the artefact morphs through during the reflow beat. */
const RATIOS = ["1 / 1", "9 / 16", "210 / 297", "1200 / 627"];

export function GateStory() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    wrap.dataset.story = "on";

    const stage = wrap.querySelector<HTMLElement>("[data-stage]");
    const frame = wrap.querySelector<HTMLElement>("[data-frame]");
    const beats = Array.from(
      wrap.querySelectorAll<HTMLElement>("[data-beat]")
    );
    const layers = {
      fields: wrap.querySelector<HTMLElement>("[data-layer='fields']"),
      cite: wrap.querySelector<HTMLElement>("[data-layer='cite']"),
      stamp: wrap.querySelector<HTMLElement>("[data-layer='stamp']"),
      revert: wrap.querySelector<HTMLElement>("[data-layer='revert']"),
      sweep: wrap.querySelector<HTMLElement>("[data-layer='sweep']"),
    };
    if (!stage || !frame) return;

    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    // Ramps 0→1 across [a,b] of the overall timeline.
    const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

    let ticking = false;

    const draw = () => {
      ticking = false;
      const rect = wrap.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;
      const p = clamp(-rect.top / scrollable);

      const n = BEATS.length;
      // Which beat owns the viewport right now.
      const active = Math.min(n - 1, Math.floor(p * n));
      beats.forEach((b, i) => {
        const d = Math.abs(i - (p * n - 0.5));
        b.style.opacity = String(clamp(1.35 - d * 1.9));
        b.style.transform = `translateY(${(i - (p * n - 0.5)) * 26}px)`;
      });

      // The artefact's own timeline.
      frame.style.setProperty("--fill", String(seg(p, 0.14, 0.3)));
      if (layers.fields) layers.fields.style.opacity = String(seg(p, 0.14, 0.3));
      if (layers.sweep)
        layers.sweep.style.setProperty(
          "--sweep",
          `${seg(p, 0.34, 0.46) * 100}%`
        );
      if (layers.cite) {
        const t = seg(p, 0.32, 0.46);
        layers.cite.style.opacity = String(t);
        layers.cite.style.transform = `translateY(${(1 - t) * 22}px)`;
      }
      if (layers.stamp) {
        const on = seg(p, 0.52, 0.62) * (1 - seg(p, 0.86, 0.92));
        layers.stamp.style.opacity = String(on);
        layers.stamp.style.transform = `scale(${0.86 + on * 0.14})`;
      }
      if (layers.revert) {
        const t = seg(p, 0.88, 0.96);
        layers.revert.style.opacity = String(t);
        layers.revert.style.transform = `scale(${0.9 + t * 0.1})`;
      }

      // Reflow beat: step through the real output ratios.
      const reflow = seg(p, 0.66, 0.86);
      const idx = Math.min(
        RATIOS.length - 1,
        Math.floor(reflow * RATIOS.length)
      );
      frame.style.aspectRatio = reflow > 0 ? RATIOS[idx] : RATIOS[0];

      // A late nudge off-centre so the climax does not sit dead centre.
      stage.style.setProperty("--shift", `${seg(p, 0.88, 1) * -10}px`);
      stage.dataset.active = String(active);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(draw);
    };

    draw();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section
      ref={wrapRef}
      aria-labelledby="story-heading"
      className="story relative bg-brand-dark"
    >
      <h2 id="story-heading" className="sr-only">
        How one asset moves from an empty frame to an approved export
      </h2>

      <div
        data-stage
        className="story-stage mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-20 sm:px-8 lg:flex-row lg:items-center lg:gap-16"
      >
        {/* Copy beats */}
        <ol className="story-beats relative flex flex-1 flex-col gap-10 lg:gap-0">
          {BEATS.map((beat) => (
            <li key={beat.kicker} data-beat className="story-beat">
              <p className="text-label text-brand-on-dark">{beat.kicker}</p>
              <p className="mt-4 text-display text-balance text-white">
                {beat.line}
              </p>
            </li>
          ))}
        </ol>

        {/* The artefact */}
        <div className="flex flex-1 items-center justify-center">
          <div
            data-frame
            style={{ aspectRatio: "1 / 1" }}
            className="story-frame relative w-full max-w-[380px] overflow-hidden rounded-card border border-white/20 bg-surface shadow-elevated"
          >
            <div className="flex h-full flex-col justify-between gap-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-brand-dark text-[12px] font-extrabold leading-none text-white">
                    B
                  </span>
                  <span className="text-caption font-bold tracking-[-0.02em] text-ink">
                    YOUR BRAND
                  </span>
                </span>

                <span className="relative flex h-6 items-center">
                  <span
                    data-layer="stamp"
                    className="story-chip absolute right-0 flex items-center gap-1.5 rounded-full bg-approve-tint px-2.5 py-1"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-approve" />
                    <span className="text-caption font-semibold leading-none text-accent-dark">
                      Approved
                    </span>
                  </span>
                  <span
                    data-layer="revert"
                    className="story-chip absolute right-0 flex items-center gap-1.5 rounded-full bg-reject-tint px-2.5 py-1"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-reject" />
                    <span className="text-caption font-semibold leading-none text-reject">
                      Back to draft
                    </span>
                  </span>
                </span>
              </div>

              <div
                data-layer="fields"
                className="story-fields flex flex-1 flex-col justify-center gap-3"
              >
                <p className="text-h1 text-balance text-ink">
                  <span data-layer="sweep" className="story-sweep">
                    Cleared for use alongside routine vaccination.
                  </span>
                </p>
                <p className="text-caption text-pretty text-ink-muted-strong">
                  Same claim, same evidence, whoever made it.
                </p>
              </div>

              <div
                data-layer="cite"
                className="story-cite rounded-control border border-edge bg-page px-3 py-2"
              >
                <p className="text-label text-accent-dark">Approved source</p>
                <p className="mt-1 text-caption text-ink-muted-strong">
                  Product data sheet · §4.2 Concomitant use
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mx-auto max-w-6xl px-5 pb-16 text-caption text-sidebar-text sm:px-8">
        Schematic illustration, not live output.
      </p>
    </section>
  );
}
