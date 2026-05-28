import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendAction } from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "tab_switch",
    {
      description: "Switch to a different browser tab by its ID. Use tab_list first to find available tab IDs.",
      inputSchema: {
        tabId: z.number().describe("Tab ID to switch to (from tab_list)"),
      },
    },
    async ({ tabId }) => {
      await sendAction({ type: "switch_tab", tabId });
      return { content: [{ type: "text", text: `✅ Switched to tab ${tabId}` }] };
    }
  );
}
