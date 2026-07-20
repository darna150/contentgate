import { mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const figwrightMcpPath =
  process.env.FIGWRIGHT_MCP_PATH ??
  path.join(projectRoot, "node_modules/@figwright/mcp/dist/index.mjs");

const BACKGROUND_OPTIONS_PAGE_ID = "52:193";

const SIZES_BY_SET = {
  "set-a": ["square", "story", "link-ad", "leaderboard", "medium-rectangle"],
  "set-b": ["square", "portrait", "story", "link-ad", "medium-rectangle"],
};

const OPTION_OUTPUT = {
  "classic-cream": "backgrounds",
  "mint-glow": "background-options/mint-glow",
  "terracotta-edge": "background-options/terracotta-edge",
  "sage-grid": "background-options/sage-grid",
};

const EXPORT_SCALES = [
  { scale: 1, suffix: "" },
  { scale: 2, suffix: "@2x" },
];

const transport = new StdioClientTransport({
  command: "node",
  args: [figwrightMcpPath],
  stderr: "inherit",
});
const client = new Client({ name: "contentgate-vector-background-export", version: "2.0.0" });

function parse(result) {
  const text = result.content.find((item) => item.type === "text")?.text ?? "{}";
  return JSON.parse(text);
}

async function call(name, args = {}) {
  return parse(await client.callTool({ name, arguments: args }));
}

function fileNameFor(sizeKey, suffix) {
  return `${sizeKey}${suffix}.png`;
}

async function exportNode(input) {
  await mkdir(input.outDir, { recursive: true });
  const exported = await call("save_screenshots", {
    nodeIds: [input.nodeId],
    outDir: input.outDir,
    format: "PNG",
    scale: input.scale,
  });
  const saved = exported.saved.find((item) => item.nodeId === input.nodeId);
  if (!saved?.path || saved.empty) {
    throw new Error(`Export failed for ${input.nodeId} (${input.name}, scale ${input.scale})`);
  }
  if (saved.path !== input.destination) await rename(saved.path, input.destination);
}

await client.connect(transport);
try {
  await client.callTool({ name: "navigate_to_page", arguments: { pageId: BACKGROUND_OPTIONS_PAGE_ID } });

  const exports = [];
  for (const [setKey, sizeKeys] of Object.entries(SIZES_BY_SET)) {
    for (const sizeKey of sizeKeys) {
      for (const [optionKey, outputFolder] of Object.entries(OPTION_OUTPUT)) {
        const nodeName = `BG_OPTION/${setKey}/${sizeKey}/${optionKey}`;
        const search = await call("search_nodes", { name: nodeName, type: "FRAME" });
        const node = search.nodes?.find((item) => item.name === nodeName && item.visible !== false);
        if (!node?.id) throw new Error(`Could not find active vector source frame: ${nodeName}`);

        const outDir = path.join(
          projectRoot,
          "public",
          "template-packages",
          "contentgate",
          setKey,
          outputFolder
        );
        for (const { scale, suffix } of EXPORT_SCALES) {
          exports.push({
            nodeId: node.id,
            name: nodeName,
            outDir,
            destination: path.join(outDir, fileNameFor(sizeKey, suffix)),
            scale,
          });
        }
      }
    }
  }

  for (const item of exports) {
    await exportNode(item);
    console.log(`Exported ${item.name} @${item.scale}x -> ${path.relative(projectRoot, item.destination)}`);
  }

  await client.callTool({ name: "navigate_to_page", arguments: { pageId: "2:2" } });
} finally {
  await client.close();
}
