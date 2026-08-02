"use client";

import { useEffect } from "react";

/*
 * Drives every scroll reveal on the landing page. Mounted once; it finds
 * `[data-reveal]` elements itself rather than wrapping each one.
 *
 * Replaces an earlier CSS `animation-timeline: view()` implementation. That
 * degraded safely but Firefox does not support view timelines at all, so a
 * large share of visitors saw no motion whatsoever — which defeats the point.
 * IntersectionObserver works everywhere.
 *
 * The usual hazard with JS reveals is shipping `opacity: 0` in the markup and
 * leaving the page blank if the script never runs. Avoided here by inverting
 * the order: nothing is hidden in CSS or on the server. On mount this hides
 * only the elements that are still BELOW the fold — anything already on screen
 * is left alone, so there is no flash and no blank page if JS fails.
 */

const HIDDEN = "hidden";
const STATE = "data-reveal-state";

export function ScrollReveal() {
  useEffect(() => {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    if (targets.length === 0) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Stagger siblings so grids arrive card by card rather than as one slab.
    const seen = new Map<Element, number>();
    const delays = new Map<HTMLElement, number>();
    const armed: HTMLElement[] = [];

    for (const el of targets) {
      const box = el.getBoundingClientRect();
      // Already visible (or above the viewport) — leave it be.
      if (box.top < window.innerHeight * 0.9) continue;

      const parent = el.parentElement ?? document.body;
      const index = seen.get(parent) ?? 0;
      seen.set(parent, index + 1);

      // Arming must be instantaneous. Without suppressing the transition the
      // element animates INTO its hidden state on load — a visible slide-down
      // and fade-out before it ever reveals.
      el.style.transition = "none";
      el.setAttribute(STATE, HIDDEN);
      delays.set(el, Math.min(index, 6) * 70);
      armed.push(el);
    }

    if (armed.length === 0) return;

    // One forced reflow flushes the hidden state, then transitions go back to
    // the stylesheet so the reveal itself animates normally. The stagger delay
    // has to be set AFTER clearing the override — `transition` is a shorthand,
    // so assigning it resets transition-delay along with everything else.
    void document.body.offsetHeight;
    armed.forEach((el) => {
      el.style.transition = "";
      el.style.transitionDelay = `${delays.get(el) ?? 0}ms`;
    });

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.removeAttribute(STATE);
          observer.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    armed.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}
