import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendAction } from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "refresh",
    {
      description: "Reload the current page",
      inputSchema: {
        skipDomWait: z.boolean().optional().describe("Set to true to skip DOM settling wait after reload."),
      },
    },
    async ({ skipDomWait }) => {
      await sendAction({ type: "refresh", skipDomWait });
      return {
        content: [{ type: "text", text: "Page reload triggered successfully." }],
      };
    }
  );
}
