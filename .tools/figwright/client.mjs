import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const figwrightMcpPath =
  process.env.FIGWRIGHT_MCP_PATH ??
  path.join(projectRoot, "node_modules/@figwright/mcp/dist/index.mjs");

const [command = "list", toolName, rawArguments = "{}"] = process.argv.slice(2);
const transport = new StdioClientTransport({
  command: "node",
  args: [figwrightMcpPath],
  stderr: "inherit",
});
const client = new Client({ name: "contentgate-figwright-client", version: "1.0.0" });

try {
  await client.connect(transport);
  if (command === "list") {
    const result = await client.listTools();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (command === "call") {
    const result = await client.callTool({
      name: toolName,
      arguments: JSON.parse(rawArguments),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} finally {
  await client.close();
}
