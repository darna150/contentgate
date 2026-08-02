"use client";

import { ArrowDown, Ban, Check, Lock, Pencil } from "lucide-react";
import { useEffect, useRef } from "react";

/*
 * The page's centrepiece. Apple's structure, Frontify's surfaces:
 *
 *   - Apple: a tall wrapper, a sticky full-height stage, copy beats moving past
 *     a persistent visual. One continuous take rather than a section stack.
 *   - Frontify: the visual is not a bare schematic card but a sequence of rich,
 *     product-grade UI panels that cross-fade as you scroll.
 *
 * Six beats, six panels, one scroll.
 *
 * Two engineering choices worth preserving:
 *
 * 1. NO REACT STATE. The scrubber writes styles imperatively from a rAF-
 *    throttled passive scroll handler. Re-rendering React every frame would be
 *    slower and pointless, and it avoids the setState-in-effect cascade.
 *
 * 2. THE MARKUP IS THE FALLBACK. Everything renders in normal flow, fully
 *    visible, as a readable sequence of panels with their copy. Pinning only
 *    engages under `data-story="on"`, set on mount and never under
 *    prefers-reduced-motion. No JS means a longer page, not a broken one.
 *
 * Schematic illustration throughout — not live output, not a screenshot of
 * Studio, and the specimen wording is illustrative rather than a real claim.
 * Kept honest against the data model: citations carry a field, an excerpt, and
 * the approved source around it. Approver and revision belong to the content
 * revision, not the citation, which is why they appear on the release panel
 * rather than the evidence one.
 */

type Beat = { kicker: string; line: string };

const BEATS: Beat[] = [
  {
    kicker: "Friday, a branch office",
    line: "Someone who was never hired to do marketing needs a flyer by Monday.",
  },
  {
    kicker: "They fill in",
    line: "The only part they know better than head office — their customer, their offer.",
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
    line: "It drops straight back to draft, and the export shuts.",
  },
];

const OPEN_FIELDS = [
  { name: "Headline", value: "Cleared for use alongside…" },
  { name: "Subhead", value: "Same claim, same evidence" },
  { name: "Offer", value: "—" },
  { name: "Image", value: "From approved library" },
  { name: "Call to action", value: "Learn more" },
];

const LOCKED = ["Layout", "Type scale", "Safe areas", "Logo", "Colour"];

const FORMATS = [
  { label: "Social post", dims: "1080 × 1080", ratio: "1 / 1" },
  { label: "Story", dims: "1080 × 1920", ratio: "9 / 16" },
  { label: "A4 flyer", dims: "210 × 297", ratio: "210 / 297" },
  { label: "Link post", dims: "1200 × 627", ratio: "1200 / 627" },
];

/** Shared chrome so every panel reads as the same product surface. */
function Panel({
  index,
  title,
  status,
  tone = "neutral",
  children,
}: {
  index: number;
  title: string;
  status: string;
  tone?: "neutral" | "good" | "bad";
  children: React.ReactNode;
}) {
  const statusTone =
    tone === "good"
      ? "bg-approve-tint text-accent-dark"
      : tone === "bad"
        ? "bg-reject-tint text-reject"
        : "bg-page text-ink-muted-strong";
  const dot =
    tone === "good"
      ? "bg-approve"
      : tone === "bad"
        ? "bg-reject"
        : "bg-edge-strong";

  return (
    <figure
      data-panel={index}
      className="story-panel m-0 flex w-full flex-col overflow-hidden rounded-card border border-edge bg-surface shadow-elevated"
    >
      <figcaption className="flex items-center justify-between gap-3 border-b border-edge px-5 py-3.5">
        <span className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-brand-dark text-[12px] font-extrabold leading-none text-white">
            C
          </span>
          <span className="text-caption font-bold tracking-[-0.01em] text-ink">
            {title}
          </span>
        </span>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${statusTone}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          <span className="text-caption font-semibold leading-none">
            {status}
          </span>
        </span>
      </figcaption>
      <div className="flex flex-1 flex-col justify-center gap-3 p-5">
        {children}
      </div>
    </figure>
  );
}

export function GateStory() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;

    wrap.dataset.story = "on";

    const beats = Array.from(wrap.querySelectorAll<HTMLElement>("[data-beat]"));
    const panels = Array.from(
      wrap.querySelectorAll<HTMLElement>("[data-panel]"),
    );
    const sweep = wrap.querySelector<HTMLElement>("[data-sweep]");
    if (beats.length === 0 || panels.length === 0) return;

    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    const n = BEATS.length;
    let ticking = false;

    const draw = () => {
      ticking = false;
      const rect = wrap.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;
      const p = clamp(-rect.top / scrollable);
      const pos = p * n; // 0 → n across the whole story

      beats.forEach((b, i) => {
        const d = pos - (i + 0.5);
        b.style.opacity = String(clamp(1.25 - Math.abs(d) * 1.9));
        b.style.transform = `translateY(${d * -22}px)`;
      });

      panels.forEach((el, i) => {
        const d = pos - (i + 0.5);
        const o = clamp(1.3 - Math.abs(d) * 2.1);
        el.style.opacity = String(o);
        el.style.transform = `translateY(${d * -16}px) scale(${0.97 + o * 0.03})`;
        el.style.pointerEvents = o > 0.5 ? "auto" : "none";
      });

      // The citation sweep fills while its own panel is on screen.
      if (sweep) {
        const local = clamp(pos - 2);
        sweep.style.setProperty("--sweep", `${clamp(local * 1.6) * 100}%`);
      }
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
        className="story-stage mx-auto flex w-full max-w-6xl flex-col gap-14 px-5 py-20 sm:px-8 lg:flex-row lg:items-center lg:gap-20"
      >
        <ol className="story-beats relative flex flex-1 flex-col gap-16 lg:gap-0">
          {BEATS.map((beat) => (
            <li key={beat.kicker} data-beat className="story-beat">
              <p className="text-label text-brand-on-dark">{beat.kicker}</p>
              <p className="mt-4 text-display text-balance text-white">
                {beat.line}
              </p>
            </li>
          ))}
        </ol>

        <div className="story-panels relative flex flex-1 flex-col gap-10 lg:block">
          {/* 1 — the empty frame */}
          <Panel index={0} title="Q4 local flyer" status="Empty">
            <div className="flex flex-col gap-2.5">
              {["Headline", "Subhead", "Image", "Call to action"].map(
                (slot) => (
                  <div
                    key={slot}
                    className="flex items-center gap-3 rounded-control border border-dashed border-edge-strong px-3 py-3"
                  >
                    <span className="text-caption font-semibold text-ink-muted-strong">
                      {slot}
                    </span>
                    <span className="ml-auto text-caption text-ink-muted-strong">
                      empty
                    </span>
                  </div>
                ),
              )}
            </div>
          </Panel>

          {/* 2 — declared fields: what opens, what does not */}
          <Panel index={1} title="Declared fields" status="Editing">
            <ul className="flex flex-col gap-2">
              {OPEN_FIELDS.map((f) => (
                <li
                  key={f.name}
                  className="flex items-center gap-3 rounded-control border border-edge bg-page px-3 py-2.5"
                >
                  <Pencil
                    className="h-3.5 w-3.5 shrink-0 text-accent-dark"
                    aria-hidden="true"
                  />
                  <span className="text-caption font-semibold text-ink">
                    {f.name}
                  </span>
                  <span className="ml-auto truncate text-caption text-ink-muted-strong">
                    {f.value}
                  </span>
                </li>
              ))}
            </ul>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {LOCKED.map((l) => (
                <li
                  key={l}
                  className="flex items-center gap-1.5 rounded-control border border-edge px-2 py-1 text-caption text-ink-muted-strong"
                >
                  <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {l}
                </li>
              ))}
            </ul>
          </Panel>

          {/* 3 — evidence */}
          <Panel index={2} title="Evidence check" status="Verifying">
            <p className="text-label text-ink-muted-strong">
              Generated · Headline
            </p>
            <p className="text-subhead text-pretty text-ink">
              Formulated for daily use, and{" "}
              <mark data-sweep className="story-sweep bg-transparent px-1">
                cleared for use alongside routine vaccination
              </mark>
              .
            </p>
            <span className="mx-auto flex items-center gap-1.5 rounded-full border border-accent-border bg-approve-tint px-2.5 py-1 text-caption font-semibold text-accent-dark">
              <ArrowDown className="h-3 w-3" aria-hidden="true" />
              matched word for word
            </span>
            <div className="rounded-control border border-edge bg-page px-3 py-2.5">
              <p className="text-label text-ink-muted-strong">
                Approved source
              </p>
              <p className="mt-1 text-caption text-ink-muted-strong">
                §4.2 Concomitant use — the product is{" "}
                <span className="font-semibold text-ink">
                  cleared for use alongside routine vaccination
                </span>{" "}
                where the interval exceeds seven days.
              </p>
            </div>
          </Panel>

          {/* 4 — release */}
          <Panel index={3} title="Release" status="Approved" tone="good">
            <dl className="flex flex-col divide-y divide-edge">
              {[
                { k: "Revision", v: "rev. 4" },
                { k: "Approved by", v: "M. Santos" },
                { k: "Date", v: "12 Mar 2026" },
                { k: "Export", v: "Unlocked for this revision" },
              ].map((row) => (
                <div
                  key={row.k}
                  className="flex items-center justify-between gap-4 py-2.5"
                >
                  <dt className="text-caption text-ink-muted-strong">
                    {row.k}
                  </dt>
                  <dd className="text-caption font-semibold text-ink">
                    {row.v}
                  </dd>
                </div>
              ))}
            </dl>
            <span className="flex items-center gap-2 rounded-control bg-approve-tint px-3 py-2 text-caption font-semibold text-accent-dark">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Evidence re-checked at approval
            </span>
          </Panel>

          {/* 5 — reflow */}
          <Panel index={4} title="Formats" status="Ready">
            <div className="grid grid-cols-4 items-end gap-3">
              {FORMATS.map((f) => (
                <div key={f.label} className="flex flex-col gap-2">
                  <div
                    style={{ aspectRatio: f.ratio }}
                    className="w-full rounded-[6px] border border-edge bg-page"
                  />
                  <span className="text-[11px] font-semibold leading-tight text-ink">
                    {f.label}
                  </span>
                  <span className="text-[11px] leading-tight text-ink-muted-strong">
                    {f.dims}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          {/* 6 — the revert */}
          <Panel
            index={5}
            title="Q4 local flyer"
            status="Back to draft"
            tone="bad"
          >
            <div className="rounded-control border border-edge bg-page px-3 py-2.5">
              <p className="text-label text-ink-muted-strong">
                Headline edited
              </p>
              <p className="mt-1 text-caption text-ink">
                cleared for use alongside{" "}
                <span className="rounded bg-reject-tint px-1 font-semibold text-reject line-through">
                  routine
                </span>{" "}
                <span className="rounded bg-reject-tint px-1 font-semibold text-reject">
                  all
                </span>{" "}
                vaccination
              </p>
            </div>
            <span className="flex items-center gap-2 rounded-control bg-reject-tint px-3 py-2 text-caption font-semibold text-reject">
              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
              Export blocked — approval no longer valid
            </span>
          </Panel>
        </div>
      </div>

      <p className="mx-auto max-w-6xl px-5 pb-16 text-caption text-sidebar-text sm:px-8">
        Schematic illustration, not live output.
      </p>
    </section>
  );
}
