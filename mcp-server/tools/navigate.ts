import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendAction, pageStateContentBlocks } from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "navigate",
    {
      description: "Navigate the browser to a URL",
      inputSchema: {
        url: z.string().describe("Full URL to navigate to"),
        skipDomWait: z.boolean().optional().describe("Set to true to skip DOM settling wait after navigation."),
      },
    },
    async ({ url, skipDomWait }) => {
      await sendAction({ type: "navigate", url, skipDomWait });
      return { content: [{ type: "text", text: `Navigated to ${url}` }, ...pageStateContentBlocks()] };
    }
  );
}
