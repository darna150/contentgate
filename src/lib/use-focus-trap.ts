"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab/Shift+Tab cycling within `panelRef` while `isOpen` — for a
 * modal-style overlay (drawer, full-screen panel) so keyboard focus can't
 * walk out into the dimmed content behind it. Pair with the overlay's own
 * Escape/scroll-lock effect; this hook only handles the Tab cycle.
 *
 * Pass `belowBreakpoint` when the same panel also renders as a non-modal
 * docked pane at wider widths (e.g. `lg:static`) — the trap only engages
 * while the panel is actually acting as an overlay.
 */
export function useFocusTrap(
  isOpen: boolean,
  panelRef: RefObject<HTMLElement | null>,
  belowBreakpoint?: number
) {
  useEffect(() => {
    if (!isOpen) return;
    if (belowBreakpoint && window.innerWidth >= belowBreakpoint) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const elements = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null);
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, panelRef, belowBreakpoint]);
}
