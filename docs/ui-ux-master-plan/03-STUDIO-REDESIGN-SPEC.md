# Studio redesign specification

## Objective

Make Studio the calm, obvious center of campaign work without weakening any locked-design, evidence, lifecycle, approval, or export rule.

Studio must let an author answer four questions at all times:

1. What am I creating?
2. What can I safely change?
3. Is the draft saved and ready?
4. What is the next step?

## Non-negotiable constraints

- Figma is the visual source of truth for every selected format.
- AI generation changes copy only.
- Approved product/background choices are explicit field values, not AI edits.
- Text must fit the authored slot; the system never alters design to make it fit.
- Unsupported claims fail closed.
- Draft QA downloads and approved exports remain distinct.
- Reviewer controls are distinct from authoring controls.

## Layout

### Desktop

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Product / Campaign / Format        Draft · Saved      Reviewer view  │
├─────────────────────┬────────────────────────────────────────────────┤
│ MESSAGE             │                                                │
│ headline             │                 WORKING PREVIEW                │
│ supporting copy      │              stable real-aspect canvas          │
│ source support       │                                                │
│                     │                                                │
│ VISUALS             │                                                │
│ product color        │                                                │
│ background           │                                                │
│                     ├────────────────────────────────────────────────┤
│ FORMATS              │ PNG · Exact size                  Submit/Export │
│ grouped channels     │                                                │
└─────────────────────┴────────────────────────────────────────────────┘
```

- Left panel: 360–400px, independently scrollable only when necessary.
- Preview: visually central, with stable dimensions and original aspect ratio.
- Footer: persistent action/status bar, never hidden below the control panel.
- Do not introduce a third permanent desktop panel unless evidence/review complexity demands it.

### Tablet

- Preview remains top/center.
- Controls become a narrower drawer or stacked regions below preview.
- Format selector uses grouped compact cards, not an overflowing horizontal row.

### Mobile

- Preview first.
- Sticky bottom action bar.
- Bottom-sheet or segmented navigation for Message, Visuals, Formats, Review.
- No nested scroll trap that obscures the Generate, Submit, or Export action.

## Header contract

Always display:

- Context path: Product / Campaign / Format
- Lifecycle status pill
- Save state
- Reviewer-mode entry/exit
- A back destination that preserves the originating scope

Use the same header for new drafts and existing drafts. Do not replace a meaningful path with an ambiguous generic back link.

## Control sections

### Message

Contains:

- Editable copy slots in authored reading order
- Live count, limit, fit status, and overflow explanation
- Source support indicator
- Manual-edit indicator when relevant

Rules:

- Required slots remain visible.
- Optional slots are labeled as optional.
- A fit error names the field and suggests shortening rather than implying layout will adapt.
- Selected evidence opens a lightweight inspectable citation sheet.

### Tone refinement

The nine directives remain available but are not equal-weight noise.

- Present a maximum of four common directives initially.
- Put the remainder behind More directions.
- A selected directive visibly changes the primary action: `Apply “Shorter”`.
- Add concise explanation for every directive.
- `Add proof point` is disabled with a source-specific reason when no approved evidence supports it.

### Visuals

Product and background choices must not look like the same control.

Product color:

- Real small shoe thumbnail
- Color name
- Selected checkmark
- Asset readiness/alpha validation remains an operator concern unless invalid

Background:

- Cropped thumbnail
- Descriptive name
- Selected ring/checkmark
- No empty placeholder tiles after assets are loaded

On selection:

- Immediate pressed/selected feedback
- Save state becomes `Saving changes…`
- Existing preview remains visible
- Overlay says `Updating preview…`
- New preview crossfades only once all required assets/fonts are ready

### Formats

Group the 42 formats by channel:

- Instagram
- Facebook/Meta
- LinkedIn
- Display
- Print
- Other

Each item needs:

- Format name
- Dimensions
- Aspect-ratio cue
- State: ready, needs generation, issue, approved

Support a campaign-default set/favorites so an ordinary client starts with relevant outputs rather than all formats.

### Review

Author view:

- Readiness summary
- Submit for review
- Clear reason when submission is blocked

Reviewer view:

- Changed copy and visual choices
- Citations/source support
- Fit and compliance summary
- Comment field
- Approve and Request changes

## State model and copy

| State | Visual treatment | Required copy |
|---|---|---|
| Idle/new | Original design visible | Generate a message to start this format |
| Saved | Quiet check/status | Saved just now |
| Saving | Reserved status area, no layout jump | Saving changes… |
| Preview update | Existing preview + veil | Updating preview… |
| Font/asset loading | Existing preview or contained skeleton | Loading locked preview… |
| AI generation | Stage indicator | Writing source-grounded copy / Checking copy fit / Building preview |
| Generation error | Local recovery card | Copy was not generated. Your prior draft is preserved. Try again. |
| Fit error | Field-local error and summary | Shorten headline by 6 characters to preserve the locked design. |
| Conflict | Recovery card, no silent overwrite | This draft changed elsewhere. Reload latest or review differences. |
| Ready to submit | Persistent footer CTA | Submit campaign for review |
| Approved | Export CTA | Download approved asset |

## Preview contract

- Preview reflects exactly the selected format's locked Figma layout.
- Preview never shows system-font copy as a final state.
- Preview never goes blank merely because a new asset is loading.
- Preview distinguishes Working preview from Original design.
- Preview maintains a stable canvas box during format changes.
- Any unavailable preview names the format and offers a safe retry.

## Campaign output overview

Add a campaign-level surface once the Studio foundation is stable:

| Format | Preview | Copy | Visuals | State | Action |
|---|---|---|---|---|---|
| Instagram square | thumbnail | fits | ready | Draft | Open |
| Instagram story | thumbnail | needs copy | inherited | Not generated | Generate |
| Facebook cover | thumbnail | fits | ready | In review | View review |

This prevents users from treating every output as an unrelated draft.

## Export UX

### Draft QA download

- Label: Download QA draft
- Explain intended use and approval limitation.
- Show selected format, dimensions, file type, and quality.
- Make draft treatment explicit if watermarked/labeled.

### Approved export

- Label: Download approved asset
- Allow only supported format/quality choices.
- Preserve preview during rendering.
- Show `Rendering approved asset…` then completion.
- Use stable, human-readable filenames.

## Acceptance criteria

- A new author can create one draft without being told what a template variant or assignment is.
- Every picker shows a real visual representation within the normal ready state.
- Selecting a visual option never blanks the preview.
- Every disabled action provides its reason at the point of action.
- A reviewer can identify every author-visible change before deciding.
- All operations preserve keyboard focus and announce meaningful status changes.
- Mobile users can reach Generate, Submit, and Export without hidden nested scrolling.
