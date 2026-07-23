import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import {
  FIGMA_PUBLISHER_SCHEMA_VERSION,
  type FigmaPublisherInput,
  type FigmaPublisherLayer,
} from "../../src/lib/template-platform/figma-publisher.ts";
import { getPublishedTemplateFrameTextSlots } from "../../src/lib/published-template-package.tsx";
import type { TemplateBundleVariant } from "../../src/lib/template-platform/manifest.ts";
import {
  TEMPLATE_OUTPUT_SIZES,
  type TemplateSizeKey,
} from "../../src/lib/template-contract.ts";
import { writeFigmaPublisherBundle } from "./write-figma-publisher-bundle.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");
const figwrightMcpPath =
  process.env.FIGWRIGHT_MCP_PATH ??
  join(projectRoot, "node_modules/@figwright/mcp/dist/index.mjs");

const CONTENTGATE_FIGMA_FILE_KEY = "ContentGate-Adaptive-Campaign-Template-System";
const outputRoot = resolve(
  process.env.FIGWRIGHT_CONTENTGATE_OUT ?? join(projectRoot, ".template-bundles/figwright-contentgate")
);
const exportScale = Number(process.env.FIGWRIGHT_EXPORT_SCALE ?? "2");

type FigmaNode = {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  fills?: Array<{
    type?: string;
    visible?: boolean;
    opacity?: number;
    color?: { r: number; g: number; b: number };
  }>;
  children?: FigmaNode[];
  characters?: string;
  fontName?: { family: string; style: string };
  fontSize?: number;
  lineHeight?: { value: number; unit: "AUTO" | "PERCENT" | "PIXELS" };
  letterSpacing?: { value: number; unit: "PERCENT" | "PIXELS" };
  textAlignHorizontal?: "CENTER" | "JUSTIFIED" | "LEFT" | "RIGHT";
  textAlignVertical?: "BOTTOM" | "CENTER" | "TOP";
};

type ContentGateFrameTarget = {
  key: TemplateSizeKey;
  label: string;
  channel: TemplateBundleVariant["channel"];
  nodeId: string;
  backgroundNodes: Array<{
    key: string;
    label: string;
    nodeId: string;
  }>;
};

type ContentGateBundleTarget = {
  layoutKey: "contentgate_local_friendly" | "contentgate_local_premium";
  folder: string;
  pageId: string;
  family: FigmaPublisherInput["family"];
  versionName: string;
  sourceVersion: string;
  frames: ContentGateFrameTarget[];
};

const targets: ContentGateBundleTarget[] = [
  {
    layoutKey: "contentgate_local_friendly",
    folder: "aerform-air01-v1",
    pageId: "5:7",
    family: {
      key: "aerform-air01-campaign",
      name: "Aerform Air 01 Campaign System",
    },
    versionName: "figwright-v1",
    sourceVersion: "aerform-air01-figwright-v1",
    frames: [
      {
        key: "portrait",
        label: "IG Portrait",
        channel: "social",
        nodeId: "6:53",
        backgroundNodes: [
          { key: "classic-cream", label: "Warm editorial studio", nodeId: "6:53" },
          { key: "mint-glow", label: "Transit concourse", nodeId: "6:67" },
          { key: "terracotta-edge", label: "Dark threshold", nodeId: "6:81" },
          { key: "sage-grid", label: "Coastal overlook", nodeId: "6:95" },
        ],
      },
      {
        key: "square",
        label: "IG Square",
        channel: "social",
        nodeId: "6:127",
        backgroundNodes: [
          { key: "classic-cream", label: "Warm editorial studio", nodeId: "6:127" },
          { key: "mint-glow", label: "Transit concourse", nodeId: "6:141" },
          { key: "terracotta-edge", label: "Dark threshold", nodeId: "6:155" },
          { key: "sage-grid", label: "Coastal overlook", nodeId: "6:169" },
        ],
      },
      {
        key: "story",
        label: "IG Story",
        channel: "social",
        nodeId: "6:201",
        backgroundNodes: [
          { key: "classic-cream", label: "Warm editorial studio", nodeId: "6:201" },
          { key: "mint-glow", label: "Transit concourse", nodeId: "6:215" },
          { key: "terracotta-edge", label: "Dark threshold", nodeId: "6:229" },
          { key: "sage-grid", label: "Coastal overlook", nodeId: "6:243" },
        ],
      },
      {
        key: "linkedin_square",
        label: "LinkedIn Square",
        channel: "social",
        nodeId: "6:275",
        backgroundNodes: [
          { key: "classic-cream", label: "Warm editorial studio", nodeId: "6:275" },
          { key: "mint-glow", label: "Transit concourse", nodeId: "6:289" },
          { key: "terracotta-edge", label: "Dark threshold", nodeId: "6:303" },
          { key: "sage-grid", label: "Coastal overlook", nodeId: "6:317" },
        ],
      },
      {
        key: "link_ad",
        label: "FB Landscape",
        channel: "social",
        nodeId: "6:349",
        backgroundNodes: [
          { key: "classic-cream", label: "Warm editorial studio", nodeId: "6:349" },
          { key: "mint-glow", label: "Transit concourse", nodeId: "6:363" },
          { key: "terracotta-edge", label: "Dark threshold", nodeId: "6:377" },
          { key: "sage-grid", label: "Coastal overlook", nodeId: "6:391" },
        ],
      },
      {
        key: "medium_rectangle",
        label: "Medium Rectangle",
        channel: "display_ad",
        nodeId: "6:645",
        backgroundNodes: [
          { key: "classic-cream", label: "Warm editorial studio", nodeId: "6:645" },
          { key: "mint-glow", label: "Transit concourse", nodeId: "6:659" },
          { key: "terracotta-edge", label: "Dark threshold", nodeId: "6:673" },
          { key: "sage-grid", label: "Coastal overlook", nodeId: "6:687" },
        ],
      },
      {
        key: "leaderboard",
        label: "Leaderboard",
        channel: "display_ad",
        nodeId: "6:719",
        backgroundNodes: [
          { key: "classic-cream", label: "Warm editorial studio", nodeId: "6:719" },
          { key: "mint-glow", label: "Transit concourse", nodeId: "6:733" },
          { key: "terracotta-edge", label: "Dark threshold", nodeId: "6:747" },
          { key: "sage-grid", label: "Coastal overlook", nodeId: "6:761" },
        ],
      },
      {
        key: "us_letter",
        label: "US Letter",
        channel: "document",
        nodeId: "6:423",
        backgroundNodes: [
          { key: "classic-cream", label: "Warm editorial studio", nodeId: "6:423" },
          { key: "mint-glow", label: "Transit concourse", nodeId: "6:437" },
          { key: "terracotta-edge", label: "Dark threshold", nodeId: "6:451" },
          { key: "sage-grid", label: "Coastal overlook", nodeId: "6:465" },
        ],
      },
      {
        key: "poster",
        label: "Poster",
        channel: "document",
        nodeId: "6:497",
        backgroundNodes: [
          { key: "classic-cream", label: "Warm editorial studio", nodeId: "6:497" },
          { key: "mint-glow", label: "Transit concourse", nodeId: "6:511" },
          { key: "terracotta-edge", label: "Dark threshold", nodeId: "6:525" },
          { key: "sage-grid", label: "Coastal overlook", nodeId: "6:539" },
        ],
      },
      {
        key: "rack_card",
        label: "Rack Card",
        channel: "document",
        nodeId: "6:571",
        backgroundNodes: [
          { key: "classic-cream", label: "Warm editorial studio", nodeId: "6:571" },
          { key: "mint-glow", label: "Transit concourse", nodeId: "6:585" },
          { key: "terracotta-edge", label: "Dark threshold", nodeId: "6:599" },
          { key: "sage-grid", label: "Coastal overlook", nodeId: "6:613" },
        ],
      },
    ],
  },
];

const fontFiles: Array<{
  family: "Inter";
  weight: 400 | 500 | 600 | 700;
  path: string;
  sourcePath: string;
}> = [
  { family: "Inter", weight: 400, path: "fonts/Inter-Regular.ttf", sourcePath: "public/fonts/Inter-Regular.ttf" },
  { family: "Inter", weight: 500, path: "fonts/Inter-Medium.ttf", sourcePath: "public/fonts/Inter-Medium.ttf" },
  { family: "Inter", weight: 600, path: "fonts/Inter-SemiBold.ttf", sourcePath: "public/fonts/Inter-SemiBold.ttf" },
  { family: "Inter", weight: 700, path: "fonts/Inter-Bold.ttf", sourcePath: "public/fonts/Inter-Bold.ttf" },
] as const;

function parseToolText(result: Awaited<ReturnType<Client["callTool"]>>) {
  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("Figwright returned no text payload.");
  return JSON.parse(text) as unknown;
}

function walk(node: FigmaNode): FigmaNode[] {
  return [node, ...(node.children ?? []).flatMap(walk)];
}

function editableNodes(frame: FigmaNode) {
  return walk(frame).filter((node) => {
    if (node.visible === false) return false;
    if (/\[cg(?::|\s)[^\]]+\]/i.test(node.name)) return true;
    return node.type === "TEXT" && node.name.startsWith("EDITABLE_");
  });
}

function fieldKeyFromLayerName(name: string) {
  const annotated = name.match(/\[cg(?::|\s)[^\]]*field=("[^"]+"|'[^']+'|[^;\s\]]+)/i)?.[1];
  if (annotated) return annotated.replace(/^["']|["']$/g, "");
  const raw = name.replace(/^EDITABLE_/, "");
  if (raw === "visual_label") return "local_detail";
  return raw;
}

function fieldLabel(field: string) {
  switch (field) {
    case "cta":
      return "CTA";
    case "local_detail":
      return "Local detail";
    case "proof_note":
      return "Proof note";
    case "subheadline":
      return "Subheadline";
    default:
      return field.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function fontWeight(style: string | undefined) {
  const normalized = style?.toLowerCase().replace(/\s+/g, "") ?? "";
  if (normalized.includes("bold") && !normalized.includes("semi")) return 700;
  if (normalized.includes("semibold")) return 600;
  if (normalized.includes("medium")) return 500;
  return 400;
}

function lineHeight(node: FigmaNode) {
  if (!node.fontSize || !node.lineHeight || node.lineHeight.unit === "AUTO") return 1.1;
  if (node.lineHeight.unit === "PERCENT") return node.lineHeight.value / 100;
  return node.lineHeight.value / node.fontSize;
}

function letterSpacing(node: FigmaNode) {
  if (!node.fontSize || !node.letterSpacing) return undefined;
  if (node.letterSpacing.unit === "PIXELS") return node.letterSpacing.value;
  return (node.letterSpacing.value / 100) * node.fontSize;
}

function hexByte(value: number) {
  return Math.round(Math.max(0, Math.min(1, value)) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

function nodeColor(node: FigmaNode) {
  const fill = node.fills?.find(
    (candidate) => candidate.visible !== false && candidate.type === "SOLID" && candidate.color
  );
  if (!fill?.color) return "#000000";
  return `#${hexByte(fill.color.r)}${hexByte(fill.color.g)}${hexByte(fill.color.b)}`;
}

function align(node: FigmaNode): FigmaPublisherLayer["align"] {
  if (node.textAlignHorizontal === "CENTER") return "center";
  if (node.textAlignHorizontal === "RIGHT") return "right";
  return "left";
}

function verticalAlign(node: FigmaNode): FigmaPublisherLayer["verticalAlign"] {
  if (node.textAlignVertical === "CENTER") return "middle";
  if (node.textAlignVertical === "BOTTOM") return "bottom";
  return "top";
}

function annotatedNumber(name: string, key: string) {
  const match = name.match(new RegExp(`${key}=("[^"]+"|'[^']+'|[^;\\s\\]]+)`, "i"))?.[1];
  if (!match) return undefined;
  const value = Number(match.replace(/^["']|["']$/g, ""));
  return Number.isFinite(value) ? value : undefined;
}

function annotationFor(input: {
  layoutKey: ContentGateBundleTarget["layoutKey"];
  variantKey: TemplateSizeKey;
  node: FigmaNode;
}) {
  const field = fieldKeyFromLayerName(input.node.name);
  const slot = getPublishedTemplateFrameTextSlots(input.layoutKey, input.variantKey)?.find(
    (candidate) => candidate.field === field
  );
  const resolvedLineHeight = lineHeight(input.node);
  const estimatedLines = Math.max(
    1,
    Math.floor(input.node.height / ((input.node.fontSize ?? 16) * resolvedLineHeight))
  );
  const maxChars = slot?.maxChars ?? Math.max(12, Math.ceil((input.node.characters?.length ?? 12) * 1.25));
  const maxLines = slot?.maxLines ?? estimatedLines;
  const minFontSize = Math.max(8, Math.floor((slot?.fontSize ?? input.node.fontSize ?? 16) * 0.72));

  return {
    field,
    text: `[cg:field=${field} label="${fieldLabel(field)}" maxChars=${maxChars} maxLines=${maxLines} minFontSize=${minFontSize} source=ai]`,
  };
}

function toPublisherLayer(input: {
  layoutKey: ContentGateBundleTarget["layoutKey"];
  variantKey: TemplateSizeKey;
  node: FigmaNode;
}): FigmaPublisherLayer | null {
  const annotatedName = /\[cg(?::|\s)[^\]]+\]/i.test(input.node.name)
    ? input.node.name
    : null;
  if (input.node.type !== "TEXT" && !annotatedName) return null;
  const annotation = annotatedName
    ? { field: fieldKeyFromLayerName(input.node.name), text: "" }
    : annotationFor(input);
  if (input.node.type !== "TEXT") {
    return {
      id: input.node.id,
      name: input.node.name,
      kind: "image",
      x: input.node.x,
      y: input.node.y,
      width: input.node.width,
      height: input.node.height,
      rotation: input.node.rotation,
    };
  }
  return {
    id: input.node.id,
    name: annotatedName ?? `${input.node.name} ${annotation.text}`,
    kind: "text",
    x: input.node.x,
    y: input.node.y,
    width: input.node.width,
    height: input.node.height,
    rotation: input.node.rotation,
    text: input.node.characters,
    fontFamily: "Inter",
    fontStyle: "normal",
    fontWeight: fontWeight(input.node.fontName?.style),
    fontSize: input.node.fontSize,
    lineHeight: lineHeight(input.node),
    letterSpacing: letterSpacing(input.node),
    color: nodeColor(input.node),
    align: align(input.node),
    verticalAlign: verticalAlign(input.node),
  };
}

function sha256(data: Uint8Array) {
  return createHash("sha256").update(data).digest("hex");
}

async function sha256File(path: string) {
  return sha256(await readFile(path));
}

function relativeBundleAssetPath(...parts: string[]) {
  return parts.join("/");
}

async function callTool(client: Client, name: string, args: Record<string, unknown>) {
  return parseToolText(await client.callTool({ name, arguments: args }));
}

async function getFrame(client: Client, nodeId: string): Promise<FigmaNode> {
  const result = (await callTool(client, "get_node", { nodeId })) as { node?: FigmaNode };
  if (!result.node) throw new Error(`Figwright could not read node ${nodeId}`);
  return result.node;
}

async function setVisible(client: Client, nodeIds: string[], visible: boolean) {
  if (nodeIds.length === 0) return;
  await client.callTool({
    name: "batch",
    arguments: {
      ops: nodeIds.map((nodeId) => ({
        tool: "set_visible",
        params: { nodeId, visible },
      })),
    },
  });
}

async function exportFrameImage(input: {
  client: Client;
  nodeId: string;
  outDir: string;
  destinationName: string;
  scale: number;
}) {
  await mkdir(input.outDir, { recursive: true });
  const exported = (await callTool(input.client, "save_screenshots", {
    nodeIds: [input.nodeId],
    outDir: input.outDir,
    format: "PNG",
    scale: input.scale,
  })) as { saved: Array<{ nodeId: string; path?: string; empty?: boolean }> };
  const saved = exported.saved.find((item) => item.nodeId === input.nodeId);
  if (!saved?.path || saved.empty) throw new Error(`Export failed for ${input.nodeId}`);
  const destination = join(input.outDir, input.destinationName);
  if (saved.path !== destination) await rename(saved.path, destination);
  return destination;
}

async function fontInputs(): Promise<FigmaPublisherInput["fonts"]> {
  return Promise.all(
    fontFiles.map(async (font) => ({
      ...font,
      sourcePath: join(projectRoot, font.sourcePath),
      sha256: await sha256File(join(projectRoot, font.sourcePath)),
    }))
  );
}

async function exportTarget(client: Client, target: ContentGateBundleTarget) {
  const sourceDirectory = join(outputRoot, target.folder, "source");
  const bundleDirectory = join(outputRoot, target.folder, "bundle");
  const assets: NonNullable<FigmaPublisherInput["assets"]> = [];
  const frames: FigmaPublisherInput["frames"] = [];

  await client.callTool({ name: "navigate_to_page", arguments: { pageId: target.pageId } });

  for (const frameTarget of target.frames) {
    const frame = await getFrame(client, frameTarget.nodeId);
    const editable = editableNodes(frame);
    const editableIds = editable.map((node) => node.id);
    const variantSourceDirectory = join(sourceDirectory, "variants", frameTarget.key);
    const targetDimensions = TEMPLATE_OUTPUT_SIZES[frameTarget.key];
    const frameExportScale = targetDimensions.w / frame.width;

    const referenceSourcePath = await exportFrameImage({
      client,
      nodeId: frameTarget.nodeId,
      outDir: variantSourceDirectory,
      destinationName: "reference.png",
      scale: frameExportScale,
    });

    await setVisible(client, editableIds, false);
    let backgroundSourcePath: string;
    try {
      backgroundSourcePath = await exportFrameImage({
        client,
        nodeId: frameTarget.nodeId,
        outDir: variantSourceDirectory,
        destinationName: "background.png",
        scale: frameExportScale,
      });
    } finally {
      await setVisible(client, editableIds, true);
    }

    const referencePath = relativeBundleAssetPath("variants", frameTarget.key, "reference.png");
    const backgroundPath = relativeBundleAssetPath("variants", frameTarget.key, "background.png");
    const backgroundOptions: NonNullable<FigmaPublisherInput["frames"][number]["backgroundOptions"]> = [];
    for (const option of frameTarget.backgroundNodes) {
      const optionFrame = option.nodeId === frameTarget.nodeId ? frame : await getFrame(client, option.nodeId);
      const optionEditableIds = editableNodes(optionFrame).map((node) => node.id);
      const optionScale = targetDimensions.w / optionFrame.width;
      await setVisible(client, optionEditableIds, false);
      let optionSourcePath: string;
      try {
        optionSourcePath = await exportFrameImage({
          client,
          nodeId: option.nodeId,
          outDir: variantSourceDirectory,
          destinationName: `background-${option.key}.png`,
          scale: optionScale,
        });
      } finally {
        await setVisible(client, optionEditableIds, true);
      }
      const optionPath = relativeBundleAssetPath(
        "variants",
        frameTarget.key,
        `background-${option.key}.png`
      );
      assets.push({
        path: optionPath,
        sourcePath: optionSourcePath,
        sha256: await sha256File(optionSourcePath),
        width: targetDimensions.w,
        height: targetDimensions.h,
        mimeType: "image/png",
      });
      backgroundOptions.push({
        key: option.key,
        label: option.label,
        assetPath: optionPath,
      });
    }
    assets.push(
      {
        path: referencePath,
        sourcePath: referenceSourcePath,
        sha256: await sha256File(referenceSourcePath),
        width: targetDimensions.w,
        height: targetDimensions.h,
        mimeType: "image/png",
      },
      {
        path: backgroundPath,
        sourcePath: backgroundSourcePath,
        sha256: await sha256File(backgroundSourcePath),
        width: targetDimensions.w,
        height: targetDimensions.h,
        mimeType: "image/png",
      }
    );
    frames.push({
      key: frameTarget.key,
      label: frameTarget.label,
      channel: frameTarget.channel,
      nodeId: frameTarget.nodeId,
      width: targetDimensions.w,
      height: targetDimensions.h,
      referenceAssetPath: referencePath,
      backgroundAssetPath: backgroundPath,
      backgroundOptions,
      layers: editable.flatMap((node) => {
        const layer = toPublisherLayer({
          layoutKey: target.layoutKey,
          variantKey: frameTarget.key,
          node,
        });
        if (!layer) return [];
        const scaledFontSize = layer.fontSize ? layer.fontSize * frameExportScale : undefined;
        const rawScaledX = layer.x * frameExportScale;
        const rawScaledY = layer.y * frameExportScale;
        const scaledX = Math.min(Math.max(0, rawScaledX), targetDimensions.w - 1);
        const scaledY = Math.min(Math.max(0, rawScaledY), targetDimensions.h - 1);
        const scaledWidth = Math.min(
          layer.width * frameExportScale,
          Math.max(1, targetDimensions.w - scaledX)
        );
        const maxLines = annotatedNumber(layer.name, "maxLines") ?? 1;
        const minimumTextHeight =
          layer.kind === "text" && scaledFontSize
            ? scaledFontSize * (layer.lineHeight ?? 1.1) * maxLines * 1.14
            : 0;
        const scaledHeight = Math.min(
          Math.max(layer.height * frameExportScale, minimumTextHeight),
          Math.max(1, targetDimensions.h - scaledY)
        );
        return [
          {
            ...layer,
            x: scaledX,
            y: scaledY,
            width: scaledWidth,
            height: scaledHeight,
            fontSize: scaledFontSize,
            letterSpacing: layer.letterSpacing
              ? layer.letterSpacing * frameExportScale
              : undefined,
          },
        ];
      }),
    });

    console.log(
      `Exported ${target.family.key}/${frameTarget.key}: ${editable.length} editable layer(s), ${frameExportScale.toFixed(4)}x PNGs`
    );
  }

  const publisherInput: FigmaPublisherInput = {
    schemaVersion: FIGMA_PUBLISHER_SCHEMA_VERSION,
    family: target.family,
    version: {
      name: target.versionName,
      sourceFileKey: CONTENTGATE_FIGMA_FILE_KEY,
      sourceVersion: target.sourceVersion,
    },
    fonts: await fontInputs(),
    frames,
    assets,
  };

  const publisherInputPath = join(outputRoot, target.folder, "publisher-input.json");
  await mkdir(dirname(publisherInputPath), { recursive: true });
  await writeFile(publisherInputPath, `${JSON.stringify(publisherInput, null, 2)}\n`);

  const result = await writeFigmaPublisherBundle({
    publisherInput,
    inputDirectory: dirname(publisherInputPath),
    outputDirectory: bundleDirectory,
  });
  if (!result.ok) {
    throw new Error(
      [
        `Preflight failed for ${target.family.key}:`,
        ...result.issues.map((issue) => `- ${issue.path}: ${issue.message}`),
      ].join("\n")
    );
  }
  console.log(`Wrote publisher input: ${publisherInputPath}`);
  console.log(`Wrote preflighted bundle: ${bundleDirectory}`);
}

async function main() {
  if (!Number.isFinite(exportScale) || exportScale <= 0) {
    throw new Error("FIGWRIGHT_EXPORT_SCALE must be a positive number.");
  }

  const transport = new StdioClientTransport({
    command: "node",
    args: [figwrightMcpPath],
    stderr: "inherit",
  });
  const client = new Client({
    name: "contentgate-figwright-publisher-export",
    version: "1.0.0",
  });

  await client.connect(transport);
  try {
    for (const target of targets) {
      await exportTarget(client, target);
    }
    await client.callTool({ name: "navigate_to_page", arguments: { pageId: "2:2" } });
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
