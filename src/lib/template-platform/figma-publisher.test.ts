import assert from "node:assert/strict";
import test from "node:test";

import { validateTemplateBundleManifest } from "./manifest.ts";
import { preflightTemplateBundle } from "./preflight.ts";
import {
  compileFigmaPublisherInput,
  FIGMA_PUBLISHER_SCHEMA_VERSION,
  type FigmaPublisherInput,
} from "./figma-publisher.ts";

const baseInput: FigmaPublisherInput = {
  schemaVersion: FIGMA_PUBLISHER_SCHEMA_VERSION,
  family: {
    key: "client-launch",
    name: "Client Launch",
  },
  version: {
    name: "v1",
    sourceFileKey: "figma-file-key",
    sourceVersion: "42",
  },
  fonts: [
    {
      family: "Inter",
      weight: 700,
      path: "fonts/Inter-Bold.ttf",
      sha256: "a".repeat(64),
    },
  ],
  assets: [
    {
      path: "variants/square/reference.png",
      sha256: "b".repeat(64),
      width: 1080,
      height: 1080,
      mimeType: "image/png",
    },
    {
      path: "variants/square/background.png",
      sha256: "c".repeat(64),
      width: 1080,
      height: 1080,
      mimeType: "image/png",
    },
  ],
  frames: [
    {
      key: "square",
      label: "Square",
      channel: "social",
      nodeId: "1:2",
      width: 1080,
      height: 1080,
      referenceAssetPath: "variants/square/reference.png",
      backgroundAssetPath: "variants/square/background.png",
      layers: [
        {
          id: "headline-layer",
          name: "Headline [cg:field=headline label=\"Headline\" maxChars=32 maxLines=2 minFontSize=56 source=ai]",
          kind: "text",
          x: 96,
          y: 560,
          width: 760,
          height: 170,
          text: "Local content, made on brand",
          fontFamily: "Inter",
          fontWeight: 700,
          fontSize: 72,
          lineHeight: 1,
          color: "#113d34",
        },
      ],
    },
  ],
};

test("compiles annotated Figma frame metadata into a publishable manifest", async () => {
  const result = compileFigmaPublisherInput(baseInput);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(validateTemplateBundleManifest(result.manifest), []);
  assert.equal(result.manifest.fields[0].key, "headline");
  assert.equal(result.manifest.fields[0].source, "ai");
  assert.equal(result.manifest.fonts[0].key, "inter-bold");
  assert.equal(result.manifest.variants[0].slots[0].kind, "text");

  const report = await preflightTemplateBundle({
    manifest: result.manifest,
    samples: [
      {
        key: "short-copy",
        fields: { headline: "Local posts" },
      },
    ],
    now: new Date("2026-07-14T00:00:00.000Z"),
  });
  assert.equal(report.ok, true, report.issues.map((issue) => issue.message).join("\n"));
});

test("blocks publisher inputs that cannot guarantee clean generated output", () => {
  const result = compileFigmaPublisherInput({
    ...baseInput,
    fonts: [],
    assets: [
      {
        path: "variants/square/reference.png",
        sha256: "b".repeat(64),
        width: 1080,
        height: 1080,
        mimeType: "image/png",
      },
    ],
    frames: [
      {
        ...baseInput.frames[0],
        referenceAssetPath: "variants/square/reference.png",
        backgroundAssetPath: "variants/square/reference.png",
      },
    ],
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.issues.some((issue) => issue.path === "fonts"), true);
  assert.equal(
    result.issues.some((issue) => issue.message.includes("separate text-free background")),
    true
  );
  assert.equal(
    result.issues.some((issue) => issue.message.includes("no matching font asset")),
    true
  );
});

test("flags conflicting field annotations across reusable frame layers", () => {
  const result = compileFigmaPublisherInput({
    ...baseInput,
    frames: [
      {
        ...baseInput.frames[0],
        layers: [
          ...baseInput.frames[0].layers,
          {
            ...baseInput.frames[0].layers[0],
            id: "headline-image-layer",
            name: "Visual [cg:field=headline type=image]",
            kind: "image",
            x: 20,
            y: 20,
            width: 100,
            height: 100,
          },
        ],
      },
    ],
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(
    result.issues.some((issue) => issue.message.includes("conflicting annotations")),
    true
  );
});
