#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDir, "..", "..");
const sourceRoot = join(projectRoot, "template-sources", "nimbus-air-campaign");
const frames = JSON.parse(await readFile(join(sourceRoot, "frames.json"), "utf8")).frames;
const outputPath = join(sourceRoot, "figma-layouts.json");
const figwrightMcpPath =
  process.env.FIGWRIGHT_MCP_PATH ??
  join(projectRoot, "node_modules/@figwright/mcp/dist/index.mjs");

function walk(node) {
  return [node, ...(node.children ?? []).flatMap(walk)];
}

function one(nodes, name) {
  const node = nodes.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (!node) throw new Error(`Missing ${name} layer in ${nodes[0]?.parentId ?? "Nimbus frame"}.`);
  return node;
}

function percent(value) {
  return value?.unit === "PERCENT" ? value.value / 100 : value?.value ?? 1;
}

function frameRelativePosition(node, frame) {
  let x = node.x;
  let y = node.y;
  let parent = node.parent;
  // Figwright returns node coordinates relative to their immediate parent.
  // Text in Nimbus lives inside a `Content` group, so resolve that nesting
  // before serialising the renderer contract.
  while (parent && parent !== frame) {
    x += parent.x ?? 0;
    y += parent.y ?? 0;
    parent = parent.parent;
  }
  return { x, y };
}

function textSlot(node, frame, field, key) {
  const position = frameRelativePosition(node, frame);
  const lineHeight = percent(node.lineHeight);
  const maxLines = field === "subheadline_2" ? 3 : 1;
  const minFontSize = Math.max(5, Math.round(node.fontSize * 0.58));
  const height = Math.max(node.height, node.fontSize * lineHeight * maxLines);
  const usableLines = Math.max(
    1,
    Math.min(maxLines, Math.floor(height / (minFontSize * lineHeight)))
  );
  const geometryMaxChars = Math.max(
    1,
    Math.floor(node.width / Math.max(1, minFontSize * 0.62)) * usableLines -
      Math.max(0, usableLines - 1)
  );
  return {
    key,
    field,
    kind: "text",
    x: position.x,
    y: position.y,
    width: node.width,
    height,
    fontKey:
      node.fontName?.family === "Dela Gothic One"
        ? "dela-gothic-one-regular"
        : "geist-mono-regular",
    fontSize: node.fontSize,
    lineHeight,
    letterSpacing: node.letterSpacing?.unit === "PIXELS" ? node.letterSpacing.value : 0,
    color: "#000000",
    align: node.textAlignHorizontal?.toLowerCase() ?? "left",
    verticalAlign:
      node.textAlignVertical === "CENTER"
        ? "middle"
        : node.textAlignVertical?.toLowerCase() ?? "top",
    maxChars: geometryMaxChars,
    maxCharsSource: "geometry",
    maxLines,
    minFontSize,
    fit: "shrink_to_fit",
  };
}

function compileFrame(frame) {
  const nodes = walk(frame);
  const background = one(nodes, "Background image");
  const product = one(nodes, "Product image");
  const headline = one(nodes, "Headline");
  const subheadline1 = one(nodes, "Subheadline 1");
  const subheadline2 = one(nodes, "Subheadline 2");
  return {
    width: frame.width,
    height: frame.height,
    background: { x: background.x, y: background.y, width: background.width, height: background.height },
    product: { x: product.x, y: product.y, width: product.width, height: product.height },
    slots: [
      {
        key: "product-slot",
        field: "__productVariantKey",
        kind: "image",
        x: product.x,
        y: product.y,
        width: product.width,
        height: product.height,
        fit: "contain",
        focalPoint: { x: 0.5, y: 0.5 },
      },
      textSlot(headline, frame, "headline", "headline-slot"),
      textSlot(subheadline1, frame, "subheadline_1", "subheadline-1-slot"),
      textSlot(subheadline2, frame, "subheadline_2", "subheadline-2-slot"),
    ],
  };
}

const transport = new StdioClientTransport({ command: "node", args: [figwrightMcpPath], stderr: "inherit" });
const client = new Client({ name: "contentgate-nimbus-extractor", version: "1.0.0" });
try {
  await client.connect(transport);
  const layouts = {};
  // Keep requests deliberately small: the desktop Figma bridge has a short
  // relay window and can drop oversized serialized frame trees.
  for (let start = 0; start < frames.length; start += 2) {
    const batch = frames.slice(start, start + 2);
    const result = await client.callTool({ name: "get_nodes_info", arguments: { nodeIds: batch.map((frame) => frame.figmaNodeId) } });
    const raw = result.content.find((item) => item.type === "text")?.text;
    const nodes = JSON.parse(raw ?? "{}").nodes ?? [];
    for (let index = 0; index < batch.length; index += 1) layouts[batch[index].key] = compileFrame(nodes[index]);
  }
  await mkdir(sourceRoot, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ sourceFileKey: "KLhc0HHyyVOtYRiNnB6VY8", layouts }, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(layouts).length} exact Nimbus Figma layouts to ${outputPath}`);
} finally {
  await client.close();
}
