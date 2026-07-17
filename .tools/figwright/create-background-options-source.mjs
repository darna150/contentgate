import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const figwrightMcpPath =
  process.env.FIGWRIGHT_MCP_PATH ??
  path.join(projectRoot, "node_modules/@figwright/mcp/dist/index.mjs");

const PAGE_NAME = "04 ContentGate Background Options";
const RESET_EXISTING =
  process.env.FIGWRIGHT_RESET_BACKGROUND_OPTIONS_SOURCE === "1";

const OPTIONS = [
  { key: "classic-cream", label: "Classic cream", folder: "backgrounds" },
  { key: "mint-glow", label: "Mint glow", folder: "background-options/mint-glow" },
  { key: "terracotta-edge", label: "Terracotta edge", folder: "background-options/terracotta-edge" },
  { key: "sage-grid", label: "Sage grid", folder: "background-options/sage-grid" },
];

const SETS = [
  {
    key: "set-a",
    label: "Set A / Local Friendly",
    x: 0,
    sizes: [
      { key: "square", filename: "square.png", width: 1080, height: 1080 },
      { key: "story", filename: "story.png", width: 1080, height: 1920 },
      { key: "link-ad", filename: "link-ad.png", width: 1200, height: 628 },
      { key: "leaderboard", filename: "leaderboard.png", width: 728, height: 90 },
      { key: "medium-rectangle", filename: "medium-rectangle.png", width: 300, height: 250 },
    ],
  },
  {
    key: "set-b",
    label: "Set B / Local Premium",
    x: 5600,
    sizes: [
      { key: "square", filename: "square.png", width: 1080, height: 1080 },
      { key: "portrait", filename: "portrait.png", width: 1080, height: 1350 },
      { key: "story", filename: "story.png", width: 1080, height: 1920 },
      { key: "link-ad", filename: "link-ad.png", width: 1200, height: 628 },
      { key: "medium-rectangle", filename: "medium-rectangle.png", width: 300, height: 250 },
    ],
  },
];

const transport = new StdioClientTransport({
  command: "node",
  args: [figwrightMcpPath],
  stderr: "inherit",
});
const client = new Client({ name: "contentgate-background-options-source", version: "1.0.0" });

function parse(result) {
  const text = result.content.find((item) => item.type === "text")?.text ?? "{}";
  return JSON.parse(text);
}

async function call(name, args = {}) {
  return parse(await client.callTool({ name, arguments: args }));
}

async function imageData(setKey, option, filename) {
  const filePath = path.join(
    projectRoot,
    "public",
    "template-packages",
    "contentgate",
    setKey,
    option.folder,
    filename
  );
  return (await readFile(filePath)).toString("base64");
}

async function main() {
  await client.connect(transport);
  try {
    const pages = await call("get_pages");
    let page = pages.pages.find((item) => item.name === PAGE_NAME);
    if (page && RESET_EXISTING) {
      const fallbackPage = pages.pages.find((item) => item.id !== page.id);
      if (fallbackPage?.id) {
        await call("navigate_to_page", { pageId: fallbackPage.id });
      }
      await call("delete_page", { pageId: page.id });
      page = null;
    }
    if (!page) {
      const created = await call("add_page", { name: PAGE_NAME });
      page = { id: created.pageId ?? created.nodeId ?? created.id, name: PAGE_NAME };
    }
    if (!page?.id) throw new Error(`Could not create or find page "${PAGE_NAME}".`);

    await call("navigate_to_page", { pageId: page.id });

    const createdNodeIds = [];
    for (const set of SETS) {
      const section = await call("create_section", {
        name: `${set.label} / Background Options Source`,
        x: set.x,
        y: 0,
        width: 5200,
        height: 5900,
      });
      const sectionId = section.nodeId;
      createdNodeIds.push(sectionId);

      const header = await call("create_text", {
        parentId: sectionId,
        characters: `${set.label}\nDesigner-approved background-only options. Keep editable text layers out of these frames. Export by BG_OPTION/{set}/{size}/{option-key}.`,
        x: 80,
        y: 64,
        fontSize: 32,
      });
      createdNodeIds.push(header.nodeId);

      let rowY = 220;
      for (const size of set.sizes) {
        const label = await call("create_text", {
          parentId: sectionId,
          characters: `${size.key} · ${size.width}×${size.height}`,
          x: 80,
          y: rowY,
          fontSize: 24,
        });
        createdNodeIds.push(label.nodeId);

        const displayWidth = size.width;
        const displayHeight = size.height;

        for (const [index, option] of OPTIONS.entries()) {
          const x = 80 + index * 1240;
          const y = rowY + 56;
          const image = await call("import_image", {
            parentId: sectionId,
            name: `BG_OPTION/${set.key}/${size.key}/${option.key}`,
            data: await imageData(set.key, option, size.filename),
            x,
            y,
            width: displayWidth,
            height: displayHeight,
            scaleMode: "FIT",
          });
          createdNodeIds.push(image.nodeId);

          const optionLabel = await call("create_text", {
            parentId: sectionId,
            characters: `${option.label}\n${option.key}`,
            x,
            y: y + displayHeight + 16,
            fontSize: 18,
          });
          createdNodeIds.push(optionLabel.nodeId);
        }

        rowY += displayHeight + 150;
      }
    }

    return { pageId: page.id, createdNodeIds };
  } finally {
    await client.close();
  }
}

const result = await main();
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
