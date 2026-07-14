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
const groups = [
  {
    pageId: "2:2",
    set: "set-a",
    frames: [
      { nodeId: "2:15", name: "square.png", textIds: ["2:45", "2:46", "2:47", "2:49", "2:50"] },
      { nodeId: "2:52", name: "story.png", textIds: ["2:83", "2:84", "2:85", "2:87", "2:88"] },
      { nodeId: "2:90", name: "link-ad.png", textIds: ["2:100", "2:101", "2:102", "2:104", "2:105"] },
      { nodeId: "2:124", name: "leaderboard.png", textIds: ["2:134", "2:135", "2:137"] },
      { nodeId: "2:138", name: "medium-rectangle.png", textIds: ["2:148", "2:149", "2:151", "2:152"] },
    ],
  },
  {
    pageId: "4:2",
    set: "set-b",
    frames: [
      { nodeId: "4:16", name: "square.png", textIds: ["4:29", "4:30", "4:32", "4:33"] },
      { nodeId: "4:35", name: "portrait.png", textIds: ["4:49", "4:50", "4:52", "4:53"] },
      { nodeId: "4:55", name: "story.png", textIds: ["4:69", "4:70", "4:72", "4:73"] },
      { nodeId: "4:74", name: "link-ad.png", textIds: ["4:84", "4:85", "4:87", "4:88"] },
      { nodeId: "4:93", name: "medium-rectangle.png", textIds: ["4:103", "4:104", "4:106", "4:107"] },
    ],
  },
];

const transport = new StdioClientTransport({
  command: "node",
  args: [figwrightMcpPath],
  stderr: "inherit",
});
const client = new Client({ name: "contentgate-background-export", version: "1.0.0" });
const parse = (result) => JSON.parse(result.content.find((item) => item.type === "text").text);
const setVisible = (nodeIds, visible) =>
  client.callTool({
    name: "batch",
    arguments: {
      ops: nodeIds.map((nodeId) => ({ tool: "set_visible", params: { nodeId, visible } })),
    },
  });

await client.connect(transport);
try {
  for (const group of groups) {
    await client.callTool({ name: "navigate_to_page", arguments: { pageId: group.pageId } });
    const outDir = path.join(
      projectRoot,
      "public/template-packages/contentgate",
      group.set,
      "backgrounds",
    );
    await mkdir(outDir, { recursive: true });
    const textIds = group.frames.flatMap((frame) => frame.textIds);
    await setVisible(textIds, false);
    try {
      const exported = parse(
        await client.callTool({
          name: "save_screenshots",
          arguments: {
            nodeIds: group.frames.map((frame) => frame.nodeId),
            outDir,
            format: "PNG",
            scale: 1,
          },
        }),
      );
      for (const frame of group.frames) {
        const saved = exported.saved.find((item) => item.nodeId === frame.nodeId);
        if (!saved?.path || saved.empty) throw new Error(`Export failed for ${frame.nodeId}`);
        const destination = path.join(outDir, frame.name);
        if (saved.path !== destination) await rename(saved.path, destination);
      }
    } finally {
      await setVisible(textIds, true);
    }
  }
  await client.callTool({ name: "navigate_to_page", arguments: { pageId: "2:2" } });
} finally {
  await client.close();
}
