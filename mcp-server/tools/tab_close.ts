import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendAction } from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "tab_close",
    {
      description: "Close a browser tab by its ID. Use tab_list first to find available tab IDs.",
      inputSchema: {
        tabId: z.number().describe("Tab ID to close (from tab_list)"),
      },
    },
    async ({ tabId }) => {
      await sendAction({ type: "close_tab", tabId });
      return { content: [{ type: "text", text: `✅ Closed tab ${tabId}` }] };
    }
  );
}
