import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendAction } from "./shared.js";

export function register(server: McpServer) {
  server.registerTool(
    "scroll_page",
    {
      description: "Scroll the page up or down",
      inputSchema: {
        deltaY: z.number().describe("Pixels to scroll. Positive = down, negative = up"),
        x: z.number().default(760).describe("X position to scroll at"),
        y: z.number().default(400).describe("Y position to scroll at"),
      },
    },
    async ({ deltaY, x, y }) => {
      const result = await sendAction({ type: "scroll", x, y, deltaY });
      return {
        content: [{ type: "text", text: `Scrolled ${deltaY}px. Result: ${JSON.stringify(result)}` }],
      };
    }
  );
}
