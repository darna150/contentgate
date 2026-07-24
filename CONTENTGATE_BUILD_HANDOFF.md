# ContentGate Build Handoff

Last updated: July 21, 2026

This file is a full orientation guide for continuing ContentGate work from a new Codex/Claude/account session without needing the original chat history.

## Project

Local repo:

```text
/Users/debbiemelgarejo/Documents/Animal-Health-Hub/contentgate
```

GitHub repo:

```text
git@github.com:darna150/contentgate.git
```

Production/live URL seen in GitHub/Vercel:

```text
https://contentgate-delta.vercel.app/
```

Main active branch for the current work:

```text
main
```

## Product goal

ContentGate is a brand-safe content generation and localization platform for distributed organizations. The intended workflow is:

1. Admin/brand team uploads and approves source documents, brand claims, product assets, and template packages.
2. Local/user teams choose a product and an approved template.
3. The app generates copy from approved source documents and template field constraints.
4. Users edit approved editable fields only.
5. Locked design/layout remains intact.
6. Users export approved/generated creative in exact output sizes.

Core principle:

```text
Figma is the design source of truth.
The app uses exact-size exported runtime assets for speed and reliability.
```

## Current architecture overview

### App framework

- Next.js App Router
- Supabase for auth/database/storage
- Vercel deployment
- Template Platform v1 for scalable template families/versions/variants
- Inter is the intended app/template font direction; avoid bringing Nunito back.

### Main areas

Important app routes:

```text
/dashboard
/products
/products/[id]
/studio/[contentId]
/studio/new
/content
/approvals
/knowledge
/ask
/assets
/templates
```

Important API routes:

```text
/api/products/generate
/api/creative/draft-preview
/api/creative/render
/api/export/[id]
/api/products/ask
/api/template-bundles/preflight
/api/template-bundles/import
/api/template-bundles/publish
```

## Template system history and current decision

The old implementation used masked screenshot-like previews and/or fallback rendering. That was not reliable.

The current direction is:

1. Original/reference mode uses full Figma PNG exports.
2. Generated mode uses clean background-only Figma exports.
3. Editable text is rendered separately on top using exact template slots.
4. Runtime should never hide baked text with masks as the final strategy.
5. Template variants and assets should be versioned, validated, and importable through Template Platform v1.

## ContentGate template families

Current ContentGate demo template families:

```text
ContentGate Local Friendly
ContentGate Local Premium
```

Public runtime assets live in two places:

Legacy/public package paths:

```text
public/template-packages/contentgate/set-a/
public/template-packages/contentgate/set-b/
```

Template bundle paths:

```text
public/template-bundles/contentgate-local-friendly/figwright-v1/
public/template-bundles/contentgate-local-premium/figwright-v1/
```

Set A sizes:

```text
square             1080x1080
story              1080x1920
link-ad            1200x628
leaderboard        728x90
medium-rectangle   300x250
```

Set B sizes:

```text
square             1080x1080
portrait           1080x1350
story              1080x1920
link-ad            1200x628
medium-rectangle   300x250
```

## New background option system

The current branch adds selectable designer-approved background options for generated templates.

Options:

```text
classic-cream
mint-glow
terracotta-edge
sage-grid
```

`classic-cream` uses the existing standard background:

```text
public/template-packages/contentgate/set-a/backgrounds/
public/template-packages/contentgate/set-b/backgrounds/
```

Alternate background PNGs live here:

```text
public/template-packages/contentgate/set-a/background-options/mint-glow/
public/template-packages/contentgate/set-a/background-options/terracotta-edge/
public/template-packages/contentgate/set-a/background-options/sage-grid/

public/template-packages/contentgate/set-b/background-options/mint-glow/
public/template-packages/contentgate/set-b/background-options/terracotta-edge/
public/template-packages/contentgate/set-b/background-options/sage-grid/
```

All PNGs must match exact 1x template dimensions. A regression test now verifies this.

Background options are intentionally visual mood/wash variants, not new template layouts. They should not add:

- new logos
- extra text
- badges
- foreground circles
- extra bars
- new UI cards
- overlapping decoration
- new illustrations

They should preserve the locked composition and only change the background atmosphere.

## Figma source of truth

The official Figma MCP was rate-limited earlier, so Figwright was installed and used as the local Figma bridge.

Installed package:

```text
@figwright/mcp@0.3.0
```

Project MCP config:

```text
.mcp.json
```

Figwright plugin files:

```text
.tools/figwright/plugin/manifest.json
/Users/debbiemelgarejo/Desktop/Figwright Plugin/manifest.json
```

Figma file:

```text
https://www.figma.com/design/IpOSq5oAG87yAGBtpYqQvG/ContentGate-Template-Prototype---Sale-Announcement
```

Important Figma pages:

```text
02 ContentGate Ads
03 ContentGate Premium Ads
04 ContentGate Background Options
```

New Figma source page:

```text
04 ContentGate Background Options
```

Layer naming convention:

```text
BG_OPTION/{set}/{size}/{option-key}
```

Examples:

```text
BG_OPTION/set-a/square/mint-glow
BG_OPTION/set-a/link-ad/terracotta-edge
BG_OPTION/set-b/portrait/sage-grid
```

Designer guidance:

```text
Keep editable text layers out of background option frames.
Keep the locked design composition intact.
Use backgrounds as mood/style choices only.
```

Script that creates/populates the Figma source page:

```text
.tools/figwright/create-background-options-source.mjs
```

Script that generates local option PNGs:

```text
scripts/generate-contentgate-background-options.mjs
```

Docs:

```text
.tools/figwright/README.md
```

## Important source files

Template bundle builder:

```text
src/lib/template-platform/contentgate-bundle.ts
```

Template manifest validation:

```text
src/lib/template-platform/manifest.ts
src/lib/template-platform/publish-readiness.ts
```

Runtime variant/background resolution:

```text
src/lib/template-platform/runtime.ts
```

Renderer:

```text
src/lib/template-platform/render.tsx
```

Studio UI:

```text
src/app/(app)/studio/studio-workspace.tsx
```

Generation API:

```text
src/app/api/products/generate/route.ts
```

Content actions:

```text
src/app/(app)/content/actions.ts
```

Key hidden field used to preserve selected background:

```ts
BACKGROUND_CHOICE_FIELD = "__backgroundAssetKey"
```

## Current Studio behavior

Studio now has architecture support for:

1. Selecting a background option.
2. Rendering the selected background in generated mode.
3. Preserving selected background during regeneration.
4. Preserving selected background when adapting the idea/copy to another size.

Claude was asked to polish Studio UI only:

- make the background picker feel like a professional design option selector
- use clearer labels
- improve thumbnails
- make selected state obvious
- improve mobile behavior
- do not rewrite renderer/runtime architecture unless there is an actual bug

## Important QA lessons from recent work

Problems that previously surfaced:

1. Generated previews were blurry because screenshots/full renders were being scaled poorly.
2. Text sometimes overlapped or clipped.
3. The right-side locked illustration sometimes got cropped in link ad.
4. Switching size did not always clearly require/generate the right size-specific draft.
5. Some generated copy was incomplete because it was being forced too hard to fit.
6. Knowledge Hub sometimes showed an error even after a successful answer.
7. Users expected brand-reference/approved items to be downloadable immediately.
8. UI needed better loading states for generation.
9. Manual QA was too whack-a-mole; broader Playwright E2E was started.

The build is much improved, but keep verifying in browser. Passing unit/build checks does not guarantee visual quality.

## Tests and checks

Run before pushing or merging:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Focused template/render checks:

```bash
npm run test:template-render
```

New exact-dimension guardrail lives in:

```text
src/lib/template-platform/contentgate-public-assets.test.ts
```

It verifies that all selectable background option PNGs exist and match exact 1x template dimensions.

## Local development

Typical local run:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

A QA test account exists for manual/E2E testing. Credentials are not stored in
this repo — get them from the password manager or from whoever ran the last QA
pass.

Treat credentials carefully. Never paste secrets into code or docs, even
temporarily — this file is committed to a public repo.

## Vercel/OpenAI/Supabase notes

The app has been deployed on Vercel.

OpenAI is the only supported AI provider. Keep API keys in Vercel env vars and `.env.local`; never commit them.

Supabase CLI issue encountered:

```text
Cannot find project ref. Have you run supabase link?
```

If using Supabase CLI, the project may need to be linked before `supabase db push`.

## Recommended next steps

1. Pull latest branch:

```bash
git fetch origin
git checkout codex/template-background-options
git pull
```

2. If Claude pushed UI polish on another branch, inspect and merge/rebase carefully.

3. Open or update PR for:

```text
codex/template-background-options
```

4. Verify CI and Vercel preview.

5. Browser QA on preview:

- Products page loads quickly.
- Template cards show clean previews.
- Studio opens for both ContentGate templates.
- Background picker appears and is understandable.
- Each background option visibly changes the generated design.
- Background option does not overlap text/logo/CTA.
- Switching size behaves clearly.
- Generated copy remains complete, not visibly cut off.
- Editing fields updates preview live.
- Brand reference/approved view is downloadable.
- Downloaded PNG has correct exact dimensions.
- Knowledge Hub Q&A returns cited answer without false error message.

6. Merge when CI, Vercel, and browser QA are green.

## PR description starter

```text
## Summary

Adds designer-approved background options for ContentGate templates.

- Adds selectable background option support to Template Platform runtime/rendering.
- Adds ContentGate background choices: classic cream, mint glow, terracotta edge, and sage grid.
- Keeps Figma as source of truth via the `04 ContentGate Background Options` page and `BG_OPTION/{set}/{size}/{option-key}` naming.
- Uses exact-size PNG exports for runtime speed and reliable downloads.
- Adds regression coverage to ensure all selectable background PNGs exist at exact 1x template dimensions.

## Validation

- npm run typecheck
- npm run lint
- npm test
- npm run build
```

## If starting in a new account/session

Paste this:

```text
We are continuing ContentGate in:
/Users/debbiemelgarejo/Documents/Content Gate/contentgate

Please read CONTENTGATE_BUILD_HANDOFF.md first. Continue from branch:
codex/template-background-options

Do not redo completed architecture work. Inspect current branch, check PR/CI state, and proceed with browser QA / Studio UI review / merge prep.
```
