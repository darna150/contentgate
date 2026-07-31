# Accessibility standard

Accessibility is a release requirement for ContentGate. New and changed UI
must meet WCAG 2.2 AA and remain usable with keyboard-only input and common
screen readers.

## Definition of done

- Use native HTML controls and landmarks before adding ARIA.
- Every form control has a programmatic name; instructions and errors are
  associated or announced when they appear.
- All actions work with Tab, Shift+Tab, Enter, Space, and the expected arrow
  keys for composite widgets. Focus is visible and restored after overlays.
- Text contrast is at least 4.5:1; large text and non-text controls are at
  least 3:1. Use the tested design tokens instead of ad hoc colors.
- Meaning is never conveyed by color alone. Decorative icons and images are
  hidden from assistive technology; informative images have useful alt text.
- Motion respects `prefers-reduced-motion`, and mobile targets are at least
  44 by 44 CSS pixels.
- Page zoom and reflow remain usable at 200% and at a 320 CSS-pixel viewport.

## Required checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

When QA credentials and the deterministic accessibility fixture point to a
Vercel Preview or dedicated QA environment:

```sh
npm run test:a11y
```

`tests/accessibility-pages.json` is the source-of-truth inventory for the
entire UI build. `npm test` fails if any `src/app/**/page.tsx` route is missing
from that inventory, so a newly added page cannot silently escape the gate.

`npm run lint` enforces the recommended `eslint-plugin-jsx-a11y` rules. Unit
tests protect contrast tokens and keyboard roving-focus behavior. The
Playwright gate covers public, authenticated, dynamic, redirect, not-found,
modal, and mobile states; runs axe WCAG 2.2 AA checks; validates labels,
headings, accessible names, unique IDs, and landmarks; exercises keyboard
sign-in, skip navigation, Escape, and focus restoration; and checks 320 CSS
pixel reflow and 44 CSS pixel button targets. Pull-request CI blocks merging
when any of these checks fail.

Staging supplies isolated fixture data only. It does not define the audit
scope: the route inventory and checks in this repository do.

Automated checks do not replace a short manual pass for screen-reader reading
order, zoom/reflow, and task comprehension. Record any intentional exception
beside the component with its rationale and a follow-up issue.
