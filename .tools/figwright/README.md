# ContentGate Figwright Workflow

This folder keeps the local Figwright helper scripts used to reproduce the ContentGate background exports without spending the official Figma MCP quota.

## Setup

1. Open the ContentGate Figma file in Figma Desktop.
2. Run the Figwright development plugin and keep the plugin panel open.
3. Start Codex or another MCP client from this repository so `.mcp.json` can load the Figwright server.

The scripts derive the repository root from their own location, so they do not depend on a local `/Users/...` path. If you need to run a different Figwright MCP build, set `FIGWRIGHT_MCP_PATH` to the desired `index.mjs`.

## Commands

List available Figwright tools:

```bash
npm run figwright:list
```

Export clean background-only PNGs for the current ContentGate Figma frames:

```bash
npm run figwright:export-backgrounds
```

Export full publisher bundles from Figwright into the Template Platform v1 contract:

```bash
npm run figwright:export-contentgate-bundles
```

This exports 2x full-reference PNGs, 2x background-only PNGs, exact editable text layer coordinates/typography, bundled Inter font checksums, `publisher-input.json`, and a preflighted bundle folder under:

```text
.template-bundles/figwright-contentgate/
  local-friendly-v1/
    publisher-input.json
    source/
    bundle/
  local-premium-v1/
    publisher-input.json
    source/
    bundle/
```

Override the raster export scale with `FIGWRIGHT_EXPORT_SCALE=3` if a client needs 3x assets.

Render generated ContentGate samples:

```bash
npm run contentgate:render-samples
```

Create contact sheets from rendered samples:

```bash
npm run contentgate:contact-sheets
```

By default, rendered samples go to `$TMPDIR/contentgate-rendered`, and contact sheets go to `$TMPDIR/contentgate-set-a-contact.png` and `$TMPDIR/contentgate-set-b-contact.png`. Override those locations with `CONTENTGATE_RENDER_DIR` and `CONTENTGATE_CONTACT_DIR`.

## Figma Export Notes

`export-backgrounds.mjs` temporarily hides the editable text layer node IDs, exports each frame at 1x PNG scale, restores text visibility, and writes the background assets under:

- `public/template-packages/contentgate/set-a/backgrounds/`
- `public/template-packages/contentgate/set-b/backgrounds/`

If the Figma file changes, update the frame and text node IDs in `export-backgrounds.mjs` before re-exporting.

For new architecture work, prefer `figwright:export-contentgate-bundles`; it reads editable layers dynamically from `EDITABLE_` layer names and validates the generated bundle before it can be imported.
